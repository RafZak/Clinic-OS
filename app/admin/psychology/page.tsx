import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { centers, patients, sessionPsychologySnapshots } from "@/db/schema";
import { PsychologyFilters } from "@/components/admin/psychology-filters";
import { PsychologyTable } from "@/components/admin/psychology-table";
import { type PsyTag } from "@/lib/psychology/tags";
import { PageHeader } from "@/components/layout/page-header";
import {
  computeGlobalRadar,
  computeGlobalTags,
} from "@/lib/psychology/aggregate";
import { getPatientSnapshots } from "@/lib/psychology/queries";
import { hasActiveMarketingConsent } from "@/lib/psychology/consent";
import type { PsyExportRow } from "@/lib/psychology/format-csv";

export const dynamic = "force-dynamic";

export default async function AdminPsychologyPage({
  searchParams,
}: {
  searchParams: Promise<{ tags?: string; consent?: string }>;
}) {
  const params = await searchParams;
  const selectedTags = (params.tags?.split(",").filter(Boolean) ??
    []) as PsyTag[];
  const consentMode = (params.consent === "all" ? "all" : "active") as
    | "active"
    | "all";

  // All patients with at least one psy snapshot
  const patientIds = await db
    .selectDistinct({ id: sessionPsychologySnapshots.patientId })
    .from(sessionPsychologySnapshots);

  const rows: PsyExportRow[] = [];
  for (const { id: pid } of patientIds) {
    const [pat] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, pid))
      .limit(1);
    if (!pat) continue;
    if (consentMode === "active" && !hasActiveMarketingConsent(pat)) continue;

    const snapshots = await getPatientSnapshots(pid);
    const radar = computeGlobalRadar(snapshots);
    const tags = computeGlobalTags(snapshots);

    if (selectedTags.length > 0 && !selectedTags.some((t) => tags.includes(t)))
      continue;

    const center = pat.centerId
      ? (
          await db
            .select({ name: centers.name })
            .from(centers)
            .where(eq(centers.id, pat.centerId))
            .limit(1)
        )[0]
      : null;

    rows.push({
      patientId: pat.id,
      fullName: pat.label,
      age: pat.age,
      centerName: center?.name ?? null,
      lastSessionDate: snapshots[0]?.createdAt ?? null,
      tags,
      globalRadar: radar,
      consentAt: pat.marketingPsyConsentAt,
    });
  }

  rows.sort(
    (a, b) =>
      (b.lastSessionDate?.getTime() ?? 0) -
      (a.lastSessionDate?.getTime() ?? 0)
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profils psychologiques"
        description={`${rows.length} patient${rows.length > 1 ? "s" : ""} avec profil scoré · filtre actif : ${
          consentMode === "active" ? "consentants" : "tous"
        }`}
      />
      <PsychologyFilters />
      <PsychologyTable rows={rows} consentMode={consentMode} />
    </div>
  );
}
