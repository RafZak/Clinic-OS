import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { isNotNull } from "drizzle-orm";

(async () => {
  const args = process.argv.slice(2);
  const explicitIds = args.filter((a) => !a.startsWith("--"));

  const { db } = await import("../db/client");
  const { sessions } = await import("../db/schema");
  const { generateRelationshipSynthesis } = await import(
    "../lib/relationship/generate"
  );

  let ids: string[] = explicitIds;
  if (ids.length === 0 || args.includes("--all")) {
    const rows = await db
      .selectDistinct({ patientId: sessions.patientId })
      .from(sessions)
      .where(isNotNull(sessions.patientId));
    ids = rows
      .map((r) => r.patientId)
      .filter((id): id is string => id !== null);
  }

  console.log(`Génération synthèse relationnelle pour ${ids.length} patient(s)…\n`);

  let ok = 0,
    skipped = 0,
    failed = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    process.stdout.write(`[${i + 1}/${ids.length}] ${id.slice(0, 8)}… `);
    try {
      const out = await generateRelationshipSynthesis(id);
      if ("ok" in out) {
        console.log(`✓ ${out.sessionsCount} session(s)`);
        ok++;
      } else {
        console.log(`skip:${out.skipped}`);
        skipped++;
      }
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nTotal: ${ok} ok, ${skipped} skipped, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
