import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { practitionerCareSnapshots, practitioners } from "@/db/schema";
import { type CareRadar, type CareSnapshot } from "./types";

type Row = typeof practitionerCareSnapshots.$inferSelect;

function rowToSnapshot(r: Row): CareSnapshot {
  const radar: CareRadar = {
    rapport: r.rapportScore,
    pedagogy: r.pedagogyScore,
    structure: r.structureScore,
    guidance: r.guidanceScore,
    followThrough: r.followThroughScore,
    adaptability: r.adaptabilityScore,
  };
  return {
    practitionerId: r.practitionerId,
    radar,
    rationale: (r.rationale as CareSnapshot["rationale"]) ?? null,
    source: r.source === "seed" ? "seed" : "ai",
    sessionsCount: r.sessionsCount,
    updatedAt: r.updatedAt,
  };
}

export async function getPractitionerCareSnapshot(
  practitionerId: string
): Promise<CareSnapshot | null> {
  const [row] = await db
    .select()
    .from(practitionerCareSnapshots)
    .where(eq(practitionerCareSnapshots.practitionerId, practitionerId))
    .limit(1);
  return row ? rowToSnapshot(row) : null;
}

/** Tous les snapshots des praticiens d'un centre (pour l'agrégat manager). */
export async function getCenterCareSnapshots(
  centerId: string
): Promise<CareSnapshot[]> {
  const rows = await db
    .select({ snap: practitionerCareSnapshots })
    .from(practitionerCareSnapshots)
    .innerJoin(
      practitioners,
      eq(practitioners.id, practitionerCareSnapshots.practitionerId)
    )
    .where(eq(practitioners.centerId, centerId));
  return rows.map((r) => rowToSnapshot(r.snap));
}
