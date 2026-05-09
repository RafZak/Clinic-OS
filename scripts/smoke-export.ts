import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const { db } = await import("../db/client");
  const { patients } = await import("../db/schema");
  const { hasActiveMarketingConsent } = await import(
    "../lib/psychology/consent"
  );
  const { buildPatientExportData } = await import(
    "../lib/psychology/export/build"
  );
  const { formatCsv } = await import("../lib/psychology/export/format-csv");
  const { formatJson } = await import("../lib/psychology/export/format-json");
  const { formatXlsx } = await import("../lib/psychology/export/format-xlsx");

  const allPatients = await db.select().from(patients);
  const eligible = allPatients.filter(hasActiveMarketingConsent);
  const ids = eligible.slice(0, 3).map((p) => p.id);

  if (ids.length === 0) {
    console.error("Aucun patient avec consentement actif. Lance d'abord les seeds.");
    process.exit(1);
  }

  console.log(`Smoke export sur ${ids.length} patients :`, ids);

  for (const locale of ["fr", "en"] as const) {
    const payload = await buildPatientExportData({
      ids,
      consentMode: "active",
      locale,
    });

    console.log(`\n=== Locale ${locale} ===`);
    console.log("count:", payload.count);
    console.log("sessions:", payload.sessions.length);
    console.log("insights:", payload.insights.length);
    console.log("timeline:", payload.timeline.length);
    console.log("recommendations OK:", payload.patients.filter((p) => p.recommendation !== null).length, "/", payload.patients.length);

    if (payload.patients[0]) {
      const p = payload.patients[0];
      console.log("Sample patient:");
      console.log("  full_name:", p.full_name);
      console.log("  status:", p.status, "/ stage:", p.current_stage);
      console.log("  tags:", p.tags.join(", "));
      console.log("  opportunity €:", p.opportunity.total_estimated_eur);
      if (p.recommendation) {
        console.log("  reco segment:", p.recommendation.priority_segment);
        console.log("  reco urgency:", p.recommendation.urgency_score);
        console.log("  reco angle:", p.recommendation.recommended_angle);
        console.log("  reco action:", p.recommendation.next_best_action);
      }
    }

    const outDir = "/tmp";
    writeFileSync(join(outDir, `smoke-export-${locale}.csv`), formatCsv(payload));
    writeFileSync(join(outDir, `smoke-export-${locale}.json`), formatJson(payload));
    writeFileSync(join(outDir, `smoke-export-${locale}.xlsx`), await formatXlsx(payload));
    console.log(`  → /tmp/smoke-export-${locale}.{csv,json,xlsx}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
