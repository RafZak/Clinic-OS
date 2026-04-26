import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, isNotNull, inArray } from "drizzle-orm";
import { patientEvents, sessions } from "../db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (vérifie .env.local)");
}

const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const db = drizzle(client);

async function main() {
  const completedWithPatient = await db
    .select({
      id: sessions.id,
      kind: sessions.kind,
      patientId: sessions.patientId,
      startedAt: sessions.startedAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, "completed"),
        isNotNull(sessions.patientId),
        inArray(sessions.kind, ["consultation", "phone_call"])
      )
    );

  if (completedWithPatient.length === 0) {
    console.log("Aucune session complétée avec patient_id.");
    return;
  }

  const sessionIds = completedWithPatient.map((s) => s.id);
  const existing = await db
    .select({ sessionId: patientEvents.sessionId })
    .from(patientEvents)
    .where(inArray(patientEvents.sessionId, sessionIds));
  const existingSet = new Set(existing.map((e) => e.sessionId));

  const missing = completedWithPatient.filter((s) => !existingSet.has(s.id));
  console.log(
    `${completedWithPatient.length} sessions complétées avec patient · ${existing.length} déjà tracées · ${missing.length} à créer.`
  );

  if (missing.length === 0) return;

  await db.insert(patientEvents).values(
    missing.map((s) => ({
      patientId: s.patientId!,
      kind: s.kind,
      sessionId: s.id,
      occurredAt: s.startedAt ?? new Date(),
    }))
  );
  console.log(`${missing.length} patient_events créés.`);

  const byPatient = new Map<string, number>();
  for (const m of missing) {
    byPatient.set(m.patientId!, (byPatient.get(m.patientId!) ?? 0) + 1);
  }
  for (const [patientId, count] of byPatient) {
    console.log(`  · ${patientId} → ${count} event(s)`);
  }
}

main()
  .then(() => client.end({ timeout: 5 }))
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await client.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
