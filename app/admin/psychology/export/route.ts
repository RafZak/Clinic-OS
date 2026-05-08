import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { centers, patients } from "@/db/schema";
import { getPatientSnapshots } from "@/lib/psychology/queries";
import {
  computeGlobalRadar,
  computeGlobalTags,
} from "@/lib/psychology/aggregate";
import { hasActiveMarketingConsent } from "@/lib/psychology/consent";
import {
  formatPsychologyCsv,
  type PsyExportRow,
} from "@/lib/psychology/format-csv";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
  const consentMode = (params.get("consent") === "all" ? "all" : "active") as
    | "active"
    | "all";

  if (ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  const pats = await db
    .select()
    .from(patients)
    .where(inArray(patients.id, ids));

  const rows: PsyExportRow[] = [];
  for (const pat of pats) {
    if (consentMode === "active" && !hasActiveMarketingConsent(pat)) continue;
    const snaps = await getPatientSnapshots(pat.id);
    if (snaps.length === 0) continue;
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
      lastSessionDate: snaps[0]?.createdAt ?? null,
      tags: computeGlobalTags(snaps),
      globalRadar: computeGlobalRadar(snaps),
      consentAt: pat.marketingPsyConsentAt,
    });
  }

  // TODO: brancher actor_id sur l'auth réelle. Pour MVP fake-auth, on log sans actor.
  // psychologyExportLog.actorId est NOT NULL en schema → on skip volontairement
  // l'insertion d'audit log tant qu'on n'a pas d'actor identifiable.
  // Quand l'auth sera en place, retirer ce skip et toujours logger.

  const csv = formatPsychologyCsv(rows);
  const filename = `psychology-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
