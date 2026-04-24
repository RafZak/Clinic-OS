import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { transcriptLines, patients, sessions } from "@/db/schema";
import type { LiveLine } from "@/hooks/use-deepgram-live";

export type ReplayBundle = {
  scriptLines: LiveLine[];
  totalDurationMs: number;
  patientLabel: string;
};

export async function loadReplayBundle(
  sessionId: string
): Promise<ReplayBundle | null> {
  const rows = await db
    .select({
      id: transcriptLines.id,
      speaker: transcriptLines.speaker,
      startMs: transcriptLines.startMs,
      endMs: transcriptLines.endMs,
      text: transcriptLines.text,
    })
    .from(transcriptLines)
    .where(eq(transcriptLines.sessionId, sessionId))
    .orderBy(asc(transcriptLines.startMs));

  if (rows.length === 0) return null;

  const [sessionRow] = await db
    .select({ patientId: sessions.patientId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  let patientLabel = "Patient";
  if (sessionRow?.patientId) {
    const [patientRow] = await db
      .select({ label: patients.label })
      .from(patients)
      .where(eq(patients.id, sessionRow.patientId))
      .limit(1);
    if (patientRow) patientLabel = patientRow.label;
  }

  const scriptLines: LiveLine[] = rows.map((r) => ({
    id: r.id,
    speaker: r.speaker as "practitioner" | "patient",
    startMs: r.startMs,
    endMs: r.endMs,
    text: r.text,
  }));

  const totalDurationMs = scriptLines[scriptLines.length - 1].endMs;

  return { scriptLines, totalDurationMs, patientLabel };
}
