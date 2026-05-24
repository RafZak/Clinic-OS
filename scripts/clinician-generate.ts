import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { eq } from "drizzle-orm";

(async () => {
  const explicit = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  const { db } = await import("../db/client");
  const { practitioners } = await import("../db/schema");
  const { generatePractitionerCareSnapshot } = await import(
    "../lib/care-quality/generate"
  );

  let ids = explicit;
  if (ids.length === 0) {
    const rows = await db
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(eq(practitioners.role, "audioprothesiste"));
    ids = rows.map((r) => r.id);
  }

  console.log(`Génération care-quality pour ${ids.length} praticien(s)…\n`);
  let ok = 0,
    skipped = 0,
    failed = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    process.stdout.write(`[${i + 1}/${ids.length}] ${id.slice(0, 8)}… `);
    try {
      const out = await generatePractitionerCareSnapshot(id);
      if ("ok" in out) {
        console.log(`✓ ${out.sessionsCount} consultation(s)`);
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
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
