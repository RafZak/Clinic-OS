import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { isNotNull, eq, and } from "drizzle-orm";

(async () => {
  const onlyKind = process.argv[2] as "consultation" | "phone_call" | undefined;
  if (onlyKind && !["consultation", "phone_call"].includes(onlyKind)) {
    console.error(`Usage: pnpm psy:rescore-all [consultation|phone_call]`);
    process.exit(1);
  }

  const { db } = await import("../db/client");
  const { sessions } = await import("../db/schema");
  const { scorePatientPsychology } = await import("../lib/psychology/score-session");

  const conditions = [
    eq(sessions.analysisStatus, "done"),
    isNotNull(sessions.patientId),
  ];
  if (onlyKind) conditions.push(eq(sessions.kind, onlyKind));

  const all = await db
    .select({ id: sessions.id, kind: sessions.kind })
    .from(sessions)
    .where(and(...conditions));

  console.log(`Re-scoring ${all.length} sessions${onlyKind ? ` (kind=${onlyKind})` : ""}...\n`);

  let ok = 0,
    skipped = 0,
    failed = 0;
  for (let i = 0; i < all.length; i++) {
    const s = all[i];
    process.stdout.write(`[${i + 1}/${all.length}] ${s.id.slice(0, 8)} ${s.kind}... `);
    try {
      const r = await scorePatientPsychology(s.id);
      if ("ok" in r) {
        console.log(`✓ tags=${r.tags.join(",") || "(none)"}`);
        ok++;
      } else {
        console.log(`skip:${r.skipped}`);
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
