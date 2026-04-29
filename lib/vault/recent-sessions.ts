import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, patients, practitioners } from "@/db/schema";
import type { VaultMetadata } from "@/lib/vault/frontmatter";

export type VaultRecentSession = {
  id: string;
  kind: "consultation" | "phone_call";
  startedAt: Date | null;
  globalScore: number | null;
  patientLabel: string | null;
  practitionerName: string | null;
};

export async function loadRecentSessionsForVaultPage(
  metadata: VaultMetadata,
  limit = 5
): Promise<VaultRecentSession[]> {
  const type = metadata.type;
  const entityId =
    typeof metadata.entity_id === "string" ? metadata.entity_id : null;
  if (!entityId) return [];

  const buildQuery = () =>
    db
      .select({
        id: sessions.id,
        kind: sessions.kind,
        startedAt: sessions.startedAt,
        globalScore: sessions.globalScore,
        patientLabel: patients.label,
        practitionerName: practitioners.fullName,
      })
      .from(sessions)
      .leftJoin(patients, eq(sessions.patientId, patients.id))
      .leftJoin(practitioners, eq(sessions.practitionerId, practitioners.id));

  let rows: Awaited<ReturnType<typeof buildQuery>>;
  if (type === "practitioner" || type === "assistant") {
    rows = await buildQuery()
      .where(eq(sessions.practitionerId, entityId))
      .orderBy(desc(sessions.startedAt))
      .limit(limit);
  } else if (type === "patient") {
    rows = await buildQuery()
      .where(eq(sessions.patientId, entityId))
      .orderBy(desc(sessions.startedAt))
      .limit(limit);
  } else if (type === "center") {
    rows = await buildQuery()
      .where(eq(practitioners.centerId, entityId))
      .orderBy(desc(sessions.startedAt))
      .limit(limit);
  } else {
    return [];
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === "phone_call" ? "phone_call" : "consultation",
    startedAt: r.startedAt,
    globalScore: r.globalScore,
    patientLabel: r.patientLabel,
    practitionerName: r.practitionerName,
  }));
}
