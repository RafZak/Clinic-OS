import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  transcriptLines,
  practitioners,
  practitionerCareSnapshots,
} from "@/db/schema";
import { getAnthropic } from "@/lib/claude";
import { CARE_AXES, type CareAxis } from "./types";
import {
  buildClinicianCarePrompt,
  CARE_MODEL,
  CARE_PROMPT_VERSION,
} from "./prompt";

export type GenerateCareOutcome =
  | { ok: true; practitionerId: string; sessionsCount: number }
  | { skipped: "no-practitioner" | "no-transcript" };

const axisProp = {
  type: "object",
  properties: {
    score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
    rationale_fr: { type: ["string", "null"] },
    rationale_en: { type: ["string", "null"] },
  },
  required: ["score", "rationale_fr", "rationale_en"],
};

const CARE_TOOL: Anthropic.Tool = {
  name: "record_care_profile",
  description:
    "Enregistre le profil care-quality du clinicien (6 axes 0-100 + rationale FR/EN).",
  input_schema: {
    type: "object",
    properties: Object.fromEntries(CARE_AXES.map((a) => [a, axisProp])),
    required: [...CARE_AXES],
  },
};

const COL: Record<
  CareAxis,
  | "rapportScore"
  | "pedagogyScore"
  | "structureScore"
  | "guidanceScore"
  | "followThroughScore"
  | "adaptabilityScore"
> = {
  rapport: "rapportScore",
  pedagogy: "pedagogyScore",
  structure: "structureScore",
  guidance: "guidanceScore",
  followThrough: "followThroughScore",
  adaptability: "adaptabilityScore",
};

type RawAxis = {
  score: number | null;
  rationale_fr: string | null;
  rationale_en: string | null;
};

export async function generatePractitionerCareSnapshot(
  practitionerId: string
): Promise<GenerateCareOutcome> {
  const [pro] = await db
    .select({ id: practitioners.id, fullName: practitioners.fullName })
    .from(practitioners)
    .where(eq(practitioners.id, practitionerId))
    .limit(1);
  if (!pro) return { skipped: "no-practitioner" };

  const sess = await db
    .select({ id: sessions.id, startedAt: sessions.startedAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.practitionerId, practitionerId),
        eq(sessions.kind, "consultation")
      )
    )
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
    const a = bySession.get(l.sessionId) ?? [];
    a.push(l);
    bySession.set(l.sessionId, a);
  }
  const transcript = sess
    .map((s, i) => {
      const body = (bySession.get(s.id) ?? [])
        .map(
          (l) =>
            `[${l.speaker === "practitioner" ? "PRO" : "PATIENT"}] ${l.text}`
        )
        .join("\n");
      return `## Consultation ${i + 1}\n${body}`;
    })
    .join("\n\n");

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CARE_MODEL,
    max_tokens: 4096,
    tools: [CARE_TOOL],
    tool_choice: { type: "tool", name: CARE_TOOL.name },
    messages: [
      {
        role: "user",
        content: buildClinicianCarePrompt({
          practitionerLabel: pro.fullName,
          transcript,
        }),
      },
    ],
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Claude n'a pas appelé l'outil record_care_profile");
  }
  const parsed = block.input as Record<string, RawAxis | undefined>;

  const values: Record<string, unknown> = {
    practitionerId,
    source: "ai",
    sessionsCount: sess.length,
    model: CARE_MODEL,
    promptVersion: CARE_PROMPT_VERSION,
    rawOutput: parsed,
  };
  const rationale: Record<string, { fr: string; en: string }> = {};
  for (const axis of CARE_AXES) {
    const a = parsed[axis];
    const score =
      a && typeof a.score === "number" && a.score >= 0 && a.score <= 100
        ? Math.round(a.score)
        : null;
    values[COL[axis]] = score;
    if (a?.rationale_fr && a?.rationale_en) {
      rationale[axis] = { fr: a.rationale_fr, en: a.rationale_en };
    }
  }
  values.rationale = rationale;

  await db
    .insert(practitionerCareSnapshots)
    .values(values as typeof practitionerCareSnapshots.$inferInsert)
    .onConflictDoUpdate({
      target: practitionerCareSnapshots.practitionerId,
      set: { ...values, updatedAt: new Date() },
    });

  return { ok: true, practitionerId, sessionsCount: sess.length };
}
