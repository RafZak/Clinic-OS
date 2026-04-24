import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  patients,
  transcriptLines,
  sessionScores,
  coachingInsights,
  sessionArtifacts,
} from "@/db/schema";
import type {
  ArtifactRow,
  ArtifactType,
  InsightCitation,
  InsightRow,
  ResultsBundle,
} from "@/lib/types/analysis";

export async function loadResultsBundle(sessionId: string): Promise<ResultsBundle | null> {
  const rows = await db
    .select()
    .from(sessions)
    .leftJoin(patients, eq(sessions.patientId, patients.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (rows.length === 0) return null;
  const { sessions: sessionRow, patients: patientRow } = rows[0];

  const [lines, scores, insightsRaw, artifactsRaw] = await Promise.all([
    db
      .select()
      .from(transcriptLines)
      .where(eq(transcriptLines.sessionId, sessionId))
      .orderBy(asc(transcriptLines.startMs)),
    db
      .select()
      .from(sessionScores)
      .where(eq(sessionScores.sessionId, sessionId))
      .orderBy(asc(sessionScores.stepNumber)),
    db
      .select()
      .from(coachingInsights)
      .where(eq(coachingInsights.sessionId, sessionId))
      .orderBy(asc(coachingInsights.relatedStep)),
    db
      .select()
      .from(sessionArtifacts)
      .where(eq(sessionArtifacts.sessionId, sessionId)),
  ]);

  const insights: InsightRow[] = insightsRaw.map((i) => ({
    ...i,
    citationChunks: Array.isArray(i.citationChunks)
      ? (i.citationChunks as InsightCitation[])
      : null,
  }));

  const artifacts: ArtifactRow[] = artifactsRaw.map((a) => ({
    ...a,
    type: a.type as ArtifactType,
  }));

  return { session: sessionRow, patient: patientRow, lines, scores, insights, artifacts };
}

export function sumEstimatedImpact(insights: InsightRow[]): number {
  return insights.reduce((acc, i) => acc + (i.estimatedImpactEur ?? 0), 0);
}
