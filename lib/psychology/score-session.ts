import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  transcriptLines,
  sessionPsychologySnapshots,
} from "@/db/schema";
import { getAnthropic } from "@/lib/claude";
import { PSY_AXES, type PsyAxis, type PsyRadar } from "./axes";
import { computeTags } from "./tags";
import { buildPsyPrompt, PSY_MODEL, PSY_PROMPT_VERSION } from "./prompt";

export type ScorePsyOutcome =
  | { ok: true; snapshotId: string; radar: PsyRadar; tags: string[] }
  | { skipped: "no-patient" | "no-transcript" | "no-content" };

type RawAxisOutput = {
  score: number | null;
  rationale: string | null;
  citation: string | null;
};

type RawOutput = {
  axes: Partial<Record<PsyAxis, RawAxisOutput>>;
  observed_keywords?: string[];
};

const MIN_TRANSCRIPT_CHARS = 100;

/**
 * Score les 6 axes psychologiques d'un patient à partir du transcript d'une session.
 * Idempotent : un appel ultérieur sur la même session écrase le snapshot précédent
 * (onConflictDoUpdate sur session_id).
 *
 * @param sessionId  Session à scorer (doit être analysée et avoir un patient)
 * @param options.dryRun  Si true, retourne le résultat sans toucher à la DB
 */
export async function scorePatientPsychology(
  sessionId: string,
  options: { dryRun?: boolean } = {}
): Promise<ScorePsyOutcome> {
  const [session] = await db
    .select({
      id: sessions.id,
      kind: sessions.kind,
      patientId: sessions.patientId,
      durationSeconds: sessions.durationSeconds,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || !session.patientId) {
    return { skipped: "no-patient" };
  }

  const lines = await db
    .select()
    .from(transcriptLines)
    .where(eq(transcriptLines.sessionId, sessionId))
    .orderBy(asc(transcriptLines.startMs));

  if (lines.length === 0) {
    return { skipped: "no-transcript" };
  }

  const transcript = formatTranscript(lines);

  if (transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
    return { skipped: "no-content" };
  }

  const sessionKind: "consultation" | "phone_call" =
    session.kind === "phone_call" ? "phone_call" : "consultation";

  const prompt = buildPsyPrompt({
    transcript,
    sessionKind,
    durationSeconds: session.durationSeconds ?? null,
  });

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: PSY_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude n'a pas retourné de texte");
  }

  const cleaned = stripMarkdownFence(textBlock.text);
  let parsed: RawOutput;
  try {
    parsed = JSON.parse(cleaned) as RawOutput;
  } catch (err) {
    throw new Error(
      `Parsing JSON échoué: ${err instanceof Error ? err.message : String(err)} — texte: ${cleaned.slice(0, 500)}`
    );
  }

  const radar = sanitizeRadar(parsed);
  const tags = computeTags(radar);

  if (options.dryRun) {
    return { ok: true, snapshotId: "(dry-run)", radar, tags };
  }

  const insertValues = {
    sessionId,
    patientId: session.patientId,
    acceptanceScore: radar.acceptance,
    motivationScore: radar.motivation,
    trustScore: radar.trust,
    priceSensitivityScore: radar.priceSensitivity,
    externalInfluenceScore: radar.externalInfluence,
    decisionStageScore: radar.decisionStage,
    tags,
    rawOutput: parsed as unknown,
    promptVersion: PSY_PROMPT_VERSION,
    model: PSY_MODEL,
  };

  const inserted = await db
    .insert(sessionPsychologySnapshots)
    .values(insertValues)
    .onConflictDoUpdate({
      target: sessionPsychologySnapshots.sessionId,
      set: {
        ...insertValues,
        createdAt: new Date(),
      },
    })
    .returning({ id: sessionPsychologySnapshots.id });

  return { ok: true, snapshotId: inserted[0].id, radar, tags };
}

function formatTranscript(
  lines: (typeof transcriptLines.$inferSelect)[]
): string {
  return lines
    .map((l) => {
      const who = l.speaker === "practitioner" ? "PRO" : "PATIENT";
      return `[${who}] ${l.text}`;
    })
    .join("\n");
}

/**
 * Claude ignore parfois la consigne « pas de markdown » et entoure le JSON
 * d'un fence ```json ... ```. On le retire si présent.
 */
function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    // Retire la première ligne (```json ou ```) et la dernière (```)
    const withoutOpening = trimmed.replace(/^```[a-zA-Z0-9]*\n?/, "");
    const withoutClosing = withoutOpening.replace(/\n?```\s*$/, "");
    return withoutClosing.trim();
  }
  return trimmed;
}

function sanitizeRadar(raw: RawOutput): PsyRadar {
  const radar = {} as PsyRadar;
  for (const axis of PSY_AXES) {
    const v = raw.axes?.[axis]?.score;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10) {
      radar[axis] = Math.round(v);
    } else {
      radar[axis] = null;
    }
  }
  return radar;
}
