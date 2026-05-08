import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, sessionPsychologySnapshots } from "@/db/schema";
import { type PsyRadar, type PsySnapshot } from "./axes";

type SnapshotRow = typeof sessionPsychologySnapshots.$inferSelect;

function rowToSnapshot(row: SnapshotRow): PsySnapshot {
  const radar: PsyRadar = {
    acceptance: row.acceptanceScore,
    motivation: row.motivationScore,
    trust: row.trustScore,
    priceSensitivity: row.priceSensitivityScore,
    externalInfluence: row.externalInfluenceScore,
    decisionStage: row.decisionStageScore,
  };
  return {
    id: row.id,
    sessionId: row.sessionId,
    patientId: row.patientId,
    radar,
    tags: row.tags,
    rawOutput: row.rawOutput,
    promptVersion: row.promptVersion,
    model: row.model,
    createdAt: row.createdAt,
  };
}

/** Tous les snapshots d'un patient, du plus récent au plus ancien. */
export async function getPatientSnapshots(
  patientId: string
): Promise<PsySnapshot[]> {
  const rows = await db
    .select()
    .from(sessionPsychologySnapshots)
    .where(eq(sessionPsychologySnapshots.patientId, patientId))
    .orderBy(desc(sessionPsychologySnapshots.createdAt));
  return rows.map(rowToSnapshot);
}

/** Snapshot d'une session précise (unique par session_id). */
export async function getSessionSnapshot(
  sessionId: string
): Promise<PsySnapshot | null> {
  const rows = await db
    .select()
    .from(sessionPsychologySnapshots)
    .where(eq(sessionPsychologySnapshots.sessionId, sessionId))
    .limit(1);
  return rows[0] ? rowToSnapshot(rows[0]) : null;
}

export type PatientByTagsRow = {
  patientId: string;
  patientLabel: string;
  centerId: string | null;
  lastSessionAt: Date;
  tags: string[];
  consentAt: Date | null;
};

/**
 * Patients dont le snapshot le plus récent contient au moins un des tags donnés.
 * Si requireConsent=true, filtre sur consentement marketing actif.
 *
 * Implémentation : sous-requête `latest` qui trouve, pour chaque patient,
 * le createdAt max de ses snapshots. On joint sur (patient_id, created_at)
 * pour ne garder que le snapshot le plus récent. Postgres array overlap
 * (`&&`) sur tags.
 */
export async function searchPatientsByTags(opts: {
  tags: string[];
  requireConsent: boolean;
  centerId?: string | null;
  daysSinceLastSession?: number;
}): Promise<PatientByTagsRow[]> {
  const latest = db
    .select({
      patientId: sessionPsychologySnapshots.patientId,
      maxAt: sql<Date>`max(${sessionPsychologySnapshots.createdAt})`.as(
        "max_at"
      ),
    })
    .from(sessionPsychologySnapshots)
    .groupBy(sessionPsychologySnapshots.patientId)
    .as("latest");

  const conditions = [
    sql`${sessionPsychologySnapshots.tags} && ${opts.tags}::text[]`,
  ];
  if (opts.requireConsent) {
    conditions.push(sql`${patients.marketingPsyConsentAt} IS NOT NULL`);
    conditions.push(
      sql`(${patients.marketingPsyRevokedAt} IS NULL OR ${patients.marketingPsyConsentAt} > ${patients.marketingPsyRevokedAt})`
    );
  }
  if (opts.centerId) {
    conditions.push(eq(patients.centerId, opts.centerId));
  }
  if (opts.daysSinceLastSession !== undefined) {
    const cutoff = new Date(
      Date.now() - opts.daysSinceLastSession * 24 * 3600 * 1000
    );
    conditions.push(sql`${latest.maxAt} <= ${cutoff}`);
  }

  const rows = await db
    .select({
      patientId: patients.id,
      patientLabel: patients.label,
      centerId: patients.centerId,
      lastSessionAt: latest.maxAt,
      tags: sessionPsychologySnapshots.tags,
      consentAt: patients.marketingPsyConsentAt,
    })
    .from(sessionPsychologySnapshots)
    .innerJoin(
      latest,
      and(
        eq(sessionPsychologySnapshots.patientId, latest.patientId),
        eq(sessionPsychologySnapshots.createdAt, latest.maxAt)
      )
    )
    .innerJoin(patients, eq(patients.id, sessionPsychologySnapshots.patientId))
    .where(and(...conditions))
    .orderBy(desc(latest.maxAt));

  return rows;
}
