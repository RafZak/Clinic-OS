import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  transcriptLines,
  patients,
  patientRelationshipSynthesis,
} from "@/db/schema";
import { getAnthropic } from "@/lib/claude";
import { COMMUNICATION_KEYS, SETBACK_KEYS, PRIORITY_KEYS } from "./taxonomy";
import {
  buildRelationshipPrompt,
  REL_MODEL,
  REL_PROMPT_VERSION,
} from "./prompt";
import type { CommunicationStyleKey, SetbackKey, PriorityKey } from "./types";

export type GenerateRelOutcome =
  | { ok: true; patientId: string; sessionsCount: number }
  | { skipped: "no-patient" | "no-transcript" };

/**
 * Sortie structurée via tool_use : l'API garantit un JSON valide, ce qui évite
 * les casses de parsing sur les longues synthèses markdown (guillemets, retours
 * ligne) qu'on avait avec une demande de JSON en texte brut.
 */
const SYNTHESIS_TOOL: Anthropic.Tool = {
  name: "record_synthesis",
  description:
    "Enregistre la synthèse relationnelle bilingue et les tags structurés du patient.",
  input_schema: {
    type: "object",
    properties: {
      abstract_md_fr: {
        type: "string",
        description: "Synthèse contextuelle en français, markdown léger.",
      },
      abstract_md_en: {
        type: "string",
        description:
          "Faithful professional English translation of the French synthesis, markdown.",
      },
      communication_style: {
        type: "object",
        properties: {
          lead: { type: "string", enum: COMMUNICATION_KEYS },
          relevant: {
            type: "array",
            items: { type: "string", enum: COMMUNICATION_KEYS },
          },
        },
        required: ["relevant"],
      },
      setbacks: {
        type: "object",
        properties: {
          present: {
            type: "array",
            items: { type: "string", enum: SETBACK_KEYS },
          },
        },
        required: ["present"],
      },
      priorities: {
        type: "object",
        properties: {
          lead: { type: "string", enum: PRIORITY_KEYS },
          relevant: {
            type: "array",
            items: { type: "string", enum: PRIORITY_KEYS },
          },
        },
        required: ["relevant"],
      },
    },
    required: [
      "abstract_md_fr",
      "abstract_md_en",
      "communication_style",
      "setbacks",
      "priorities",
    ],
  },
};

function keepKnown<T extends string>(arr: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (x): x is T =>
      typeof x === "string" && (allowed as readonly string[]).includes(x)
  );
}

function keepOne<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

/**
 * Génère (ou régénère) la synthèse relationnelle d'un patient à partir du
 * verbatim de toutes ses sessions. Idempotent (upsert sur patient_id).
 */
export async function generateRelationshipSynthesis(
  patientId: string
): Promise<GenerateRelOutcome> {
  const [patient] = await db
    .select({ id: patients.id, label: patients.label })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) return { skipped: "no-patient" };

  const sess = await db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      kind: sessions.kind,
    })
    .from(sessions)
    .where(eq(sessions.patientId, patientId))
    .orderBy(asc(sessions.startedAt));
  if (sess.length === 0) return { skipped: "no-transcript" };

  const lines = await db
    .select()
    .from(transcriptLines)
    .where(
      inArray(
        transcriptLines.sessionId,
        sess.map((s) => s.id)
      )
    )
    .orderBy(asc(transcriptLines.startMs));
  if (lines.length === 0) return { skipped: "no-transcript" };

  const bySession = new Map<string, typeof lines>();
  for (const l of lines) {
    const arr = bySession.get(l.sessionId) ?? [];
    arr.push(l);
    bySession.set(l.sessionId, arr);
  }

  const transcript = sess
    .map((s, i) => {
      const body = (bySession.get(s.id) ?? [])
        .map(
          (l) =>
            `[${l.speaker === "practitioner" ? "PRO" : "PATIENT"}] ${l.text}`
        )
        .join("\n");
      const date = s.startedAt
        ? new Date(s.startedAt).toISOString().slice(0, 10)
        : "?";
      return `## Session ${i + 1} (${s.kind}, ${date})\n${body}`;
    })
    .join("\n\n");

  const prompt = buildRelationshipPrompt({
    patientLabel: patient.label,
    transcript,
  });

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: REL_MODEL,
    max_tokens: 8192,
    tools: [SYNTHESIS_TOOL],
    tool_choice: { type: "tool", name: SYNTHESIS_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Claude n'a pas appelé l'outil record_synthesis");
  }
  const parsed = block.input as Record<string, unknown>;

  const comm = (parsed.communication_style ?? {}) as Record<string, unknown>;
  const setb = (parsed.setbacks ?? {}) as Record<string, unknown>;
  const prio = (parsed.priorities ?? {}) as Record<string, unknown>;

  const values = {
    patientId,
    abstractMd:
      typeof parsed.abstract_md_fr === "string"
        ? parsed.abstract_md_fr
        : typeof parsed.abstract_md === "string"
          ? parsed.abstract_md
          : "",
    abstractMdEn:
      typeof parsed.abstract_md_en === "string" ? parsed.abstract_md_en : null,
    communicationStyle: {
      lead: keepOne<CommunicationStyleKey>(comm.lead, COMMUNICATION_KEYS),
      relevant: keepKnown<CommunicationStyleKey>(
        comm.relevant,
        COMMUNICATION_KEYS
      ),
    },
    setbacks: { present: keepKnown<SetbackKey>(setb.present, SETBACK_KEYS) },
    priorities: {
      lead: keepOne<PriorityKey>(prio.lead, PRIORITY_KEYS),
      relevant: keepKnown<PriorityKey>(prio.relevant, PRIORITY_KEYS),
    },
    sessionsCount: sess.length,
    model: REL_MODEL,
    promptVersion: REL_PROMPT_VERSION,
    rawOutput: parsed as unknown,
  };

  await db
    .insert(patientRelationshipSynthesis)
    .values(values)
    .onConflictDoUpdate({
      target: patientRelationshipSynthesis.patientId,
      set: { ...values, updatedAt: new Date() },
    });

  return { ok: true, patientId, sessionsCount: sess.length };
}
