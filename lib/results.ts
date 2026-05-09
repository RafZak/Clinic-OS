import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  patients,
  practitioners,
  transcriptLines,
  sessionScores,
  coachingInsights,
  sessionArtifacts,
  knowledgeChunks,
  vaultPages,
  sessionPsychologySnapshots,
} from "@/db/schema";
import { isMasterFile } from "@/lib/knowledge/master";
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
    .leftJoin(practitioners, eq(sessions.practitionerId, practitioners.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (rows.length === 0) return null;
  const { sessions: sessionRow, patients: patientRow, practitioners: practitionerRow } = rows[0];

  const [lines, scores, insightsRaw, artifactsRaw, practitionerVault, sessionVault] =
    await Promise.all([
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
      practitionerRow
        ? db
            .select({
              path: vaultPages.path,
              title: vaultPages.title,
              updatedAt: vaultPages.updatedAt,
            })
            .from(vaultPages)
            .where(
              and(
                eq(vaultPages.kind, "practitioner"),
                eq(vaultPages.entityId, practitionerRow.id)
              )
            )
            .limit(1)
        : Promise.resolve([] as { path: string; title: string; updatedAt: Date | null }[]),
      db
        .select({
          path: vaultPages.path,
          title: vaultPages.title,
          updatedAt: vaultPages.updatedAt,
        })
        .from(vaultPages)
        .where(and(eq(vaultPages.kind, "session"), eq(vaultPages.entityId, sessionId)))
        .limit(1),
    ]);

  const insights: InsightRow[] = insightsRaw.map((i) => ({
    ...i,
    citationChunks: Array.isArray(i.citationChunks)
      ? (i.citationChunks as InsightCitation[])
      : null,
  }));

  // Hydrate citations with up-to-date driveFileId/sourceType from
  // knowledge_chunks (data may pre-date the field being stored), and
  // filter Master* files which should never surface as user-facing sources.
  const citationIds = Array.from(
    new Set(
      insights
        .flatMap((i) => i.citationChunks ?? [])
        .map((c) => c.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  if (citationIds.length > 0) {
    const chunkRows = await db
      .select({
        id: knowledgeChunks.id,
        sourceFile: knowledgeChunks.sourceFile,
        sourceType: knowledgeChunks.sourceType,
        driveFileId: knowledgeChunks.driveFileId,
        programSlug: knowledgeChunks.programSlug,
        moduleNumber: knowledgeChunks.moduleNumber,
      })
      .from(knowledgeChunks)
      .where(inArray(knowledgeChunks.id, citationIds));
    const byId = new Map(chunkRows.map((r) => [r.id, r]));
    for (const insight of insights) {
      if (!insight.citationChunks) continue;
      const filtered: InsightCitation[] = [];
      for (const c of insight.citationChunks) {
        const fresh = byId.get(c.id);
        const sourceFile = fresh?.sourceFile ?? c.sourceFile;
        if (isMasterFile(sourceFile)) continue;
        filtered.push({
          ...c,
          sourceFile,
          sourceType: fresh?.sourceType ?? c.sourceType ?? null,
          driveFileId: fresh?.driveFileId ?? c.driveFileId ?? null,
          programSlug: fresh?.programSlug ?? c.programSlug,
          moduleNumber: fresh?.moduleNumber ?? c.moduleNumber,
        });
      }
      insight.citationChunks = filtered.length > 0 ? filtered : null;
    }
  } else {
    // Aucune citation, rien à hydrater — mais on filtre quand même les
    // citations malformées sans id pour être sûr.
    for (const insight of insights) {
      if (!insight.citationChunks) continue;
      const filtered = insight.citationChunks.filter(
        (c) => !isMasterFile(c.sourceFile)
      );
      insight.citationChunks = filtered.length > 0 ? filtered : null;
    }
  }

  const artifacts: ArtifactRow[] = artifactsRaw.map((a) => ({
    ...a,
    type: a.type as ArtifactType,
  }));

  // hasPsyProfile : true si le patient a ≥ 1 snapshot psy. Détermine
  // l'affichage du bouton "Régénérer avec profil psy" dans les livrables.
  let hasPsyProfile = false;
  if (patientRow?.id) {
    const psyCount = await db
      .select({ id: sessionPsychologySnapshots.id })
      .from(sessionPsychologySnapshots)
      .where(eq(sessionPsychologySnapshots.patientId, patientRow.id))
      .limit(1);
    hasPsyProfile = psyCount.length > 0;
  }

  return {
    session: sessionRow,
    patient: patientRow,
    lines,
    scores,
    insights,
    artifacts,
    practitionerVault: practitionerVault[0] ?? null,
    sessionVault: sessionVault[0] ?? null,
    hasPsyProfile,
  };
}

