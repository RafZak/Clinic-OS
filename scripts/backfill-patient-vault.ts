import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const { and, desc, eq, isNotNull, inArray, sql } = await import(
    "drizzle-orm"
  );
  const { sessions, patients, vaultPages } = await import("../db/schema");
  const { updateVaultForSession, slugify } = await import(
    "../lib/vault/ingest"
  );

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (vérifie .env.local)");
  }
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(client);

  const candidates = await db
    .select({
      patientId: sessions.patientId,
      patientLabel: patients.label,
      sessionId: sessions.id,
      startedAt: sessions.startedAt,
    })
    .from(sessions)
    .innerJoin(patients, eq(sessions.patientId, patients.id))
    .where(
      and(
        eq(sessions.status, "completed"),
        eq(sessions.analysisStatus, "done"),
        isNotNull(sessions.patientId),
        inArray(sessions.kind, ["consultation", "phone_call"])
      )
    )
    .orderBy(desc(sessions.startedAt));

  if (candidates.length === 0) {
    console.log("Aucune session analysée avec patient.");
    await client.end({ timeout: 5 });
    return;
  }

  // Garde la session la plus récente par patient
  const latestByPatient = new Map<
    string,
    { patientId: string; patientLabel: string; sessionId: string }
  >();
  for (const c of candidates) {
    if (!c.patientId) continue;
    if (!latestByPatient.has(c.patientId)) {
      latestByPatient.set(c.patientId, {
        patientId: c.patientId,
        patientLabel: c.patientLabel,
        sessionId: c.sessionId,
      });
    }
  }

  // Patients qui ont déjà une fiche vault
  const expectedPaths = Array.from(latestByPatient.values()).map(
    (p) => `patients/${slugify(p.patientLabel)}.md`
  );
  const existing = await db
    .select({ path: vaultPages.path })
    .from(vaultPages)
    .where(inArray(vaultPages.path, expectedPaths));
  const existingSet = new Set(existing.map((e) => e.path));

  const missing = Array.from(latestByPatient.values()).filter(
    (p) => !existingSet.has(`patients/${slugify(p.patientLabel)}.md`)
  );

  console.log(
    `${latestByPatient.size} patients avec session analysée · ${existing.length} avec fiche vault · ${missing.length} à générer.`
  );

  if (missing.length === 0) {
    await client.end({ timeout: 5 });
    return;
  }

  // Pas besoin de la connexion locale pour le pipeline (il a la sienne)
  await client.end({ timeout: 5 });

  let ok = 0;
  let failed = 0;
  for (const p of missing) {
    process.stdout.write(`→ ${p.patientLabel} (session ${p.sessionId.slice(0, 8)}) ... `);
    try {
      const result = await updateVaultForSession(p.sessionId);
      if ("ok" in result && result.ok) {
        console.log(`OK (${result.patches} patches, ${result.durationMs}ms)`);
        ok += 1;
      } else {
        console.log(`KO (${"error" in result ? result.error : "unknown"})`);
        failed += 1;
      }
    } catch (err) {
      console.log(`EXCEPTION (${err instanceof Error ? err.message : String(err)})`);
      failed += 1;
    }
  }

  console.log(`\nDone. ${ok} succès, ${failed} échecs.`);
  void sql;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
