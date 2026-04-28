import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import {
  centers,
  practitioners,
  patients,
  sessions,
  transcriptLines,
  sessionScores,
  coachingInsights,
  patientEvents,
} from "../db/schema";
import { REPLAY_SCENARIOS, computeTimedLines } from "./replay/scripts";

config({ path: ".env.local" });

const CENTER_NAME = "Lyon 3";
const CENTER_CITY = "Lyon";
const PRACTITIONER_FULL_NAME = "Jonathan Goldminc";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("→ Seed replay");

  const [center] =
    (await db.select().from(centers).where(eq(centers.name, CENTER_NAME))) ?? [];
  const resolvedCenter =
    center ??
    (
      await db
        .insert(centers)
        .values({ name: CENTER_NAME, city: CENTER_CITY })
        .returning()
    )[0];
  console.log(`  centre: ${resolvedCenter.name} (${resolvedCenter.id})`);

  const [practitioner] =
    (await db
      .select()
      .from(practitioners)
      .where(
        and(
          eq(practitioners.fullName, PRACTITIONER_FULL_NAME),
          eq(practitioners.centerId, resolvedCenter.id)
        )
      )) ?? [];
  const resolvedPractitioner =
    practitioner ??
    (
      await db
        .insert(practitioners)
        .values({
          fullName: PRACTITIONER_FULL_NAME,
          role: "audioprothesiste",
          centerId: resolvedCenter.id,
        })
        .returning()
    )[0];
  console.log(
    `  audioprothésiste: ${resolvedPractitioner.fullName} (${resolvedPractitioner.id})`
  );

  for (const scenario of REPLAY_SCENARIOS) {
    console.log(`\n→ ${scenario.slug}`);

    const [existingPatient] =
      (await db
        .select()
        .from(patients)
        .where(eq(patients.label, scenario.patientLabel))) ?? [];
    const patient =
      existingPatient ??
      (
        await db
          .insert(patients)
          .values({
            label: scenario.patientLabel,
            age: scenario.patientAge,
            status: scenario.patientStatus,
            centerId: resolvedCenter.id,
            firstContactAt: new Date(),
          })
          .returning()
      )[0];
    if (existingPatient) {
      await db
        .update(patients)
        .set({
          age: scenario.patientAge,
          status: scenario.patientStatus,
          centerId: resolvedCenter.id,
        })
        .where(eq(patients.id, patient.id));
    }
    console.log(`  patient: ${patient.label} (${patient.id})`);

    const existingSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.source, "replay"), eq(sessions.patientId, patient.id))
      );
    for (const s of existingSessions) {
      await db.delete(patientEvents).where(eq(patientEvents.sessionId, s.id));
      await db.delete(sessionScores).where(eq(sessionScores.sessionId, s.id));
      await db
        .delete(coachingInsights)
        .where(eq(coachingInsights.sessionId, s.id));
      await db.delete(transcriptLines).where(eq(transcriptLines.sessionId, s.id));
      await db.delete(sessions).where(eq(sessions.id, s.id));
    }

    const [session] = await db
      .insert(sessions)
      .values({
        kind: "consultation",
        source: "replay",
        status: "in_progress",
        analysisStatus: "pending",
        practitionerId: resolvedPractitioner.id,
        patientId: patient.id,
        durationSeconds: scenario.targetDurationSeconds,
      })
      .returning();
    console.log(`  session: ${session.id}`);

    const timed = computeTimedLines(scenario.turns);
    await db.insert(transcriptLines).values(
      timed.map((line) => ({
        sessionId: session.id,
        speaker: line.speaker,
        startMs: line.startMs,
        endMs: line.endMs,
        text: line.text,
        confidence: "1.000",
      }))
    );
    const totalSec = Math.round(timed[timed.length - 1].endMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    console.log(
      `  transcript: ${timed.length} lignes, ${mins}m${secs.toString().padStart(2, "0")}s`
    );
  }

  await client.end();
  console.log("\n✓ Replay seedé.");
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
