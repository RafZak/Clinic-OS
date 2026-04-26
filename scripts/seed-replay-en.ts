/**
 * Seed for the EN bilingual demo.
 *
 * Creates:
 * - 1 EN center: London Bridge
 * - 2 EN practitioners: Dr. Sarah Mitchell (audiologist) + James Carter (front-desk)
 * - 2 EN patients: Mrs. Eleanor Davis (consultation) + Mr. Robert Wilson (phone)
 * - 2 sessions in `metadata.locale='en'` with transcript_lines pre-inserted
 *
 * Idempotent: re-running clears prior replay sessions for these patients
 * but leaves the entities themselves intact.
 *
 * Usage: pnpm seed:replay-en
 */
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
} from "../db/schema";
import {
  REPLAY_SCENARIOS_EN,
  REPLAY_PHONE_SCENARIOS_EN,
  computeTimedLines,
} from "./replay/scripts-en";

config({ path: ".env.local" });

const CENTER_NAME = "London Bridge";
const CENTER_CITY = "London";
const AUDIOLOGIST_FULL_NAME = "Dr. Sarah Mitchell";
const ASSISTANT_FULL_NAME = "James Carter";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("→ Seed replay EN");

  // Center
  const [existingCenter] = await db
    .select()
    .from(centers)
    .where(eq(centers.name, CENTER_NAME));
  const center =
    existingCenter ??
    (
      await db
        .insert(centers)
        .values({ name: CENTER_NAME, city: CENTER_CITY })
        .returning()
    )[0];
  console.log(`  center: ${center.name} (${center.id})`);

  // Audiologist
  const [existingAudiologist] = await db
    .select()
    .from(practitioners)
    .where(
      and(
        eq(practitioners.fullName, AUDIOLOGIST_FULL_NAME),
        eq(practitioners.centerId, center.id)
      )
    );
  const audiologist =
    existingAudiologist ??
    (
      await db
        .insert(practitioners)
        .values({
          fullName: AUDIOLOGIST_FULL_NAME,
          role: "audioprothesiste",
          centerId: center.id,
        })
        .returning()
    )[0];
  console.log(`  audiologist: ${audiologist.fullName} (${audiologist.id})`);

  // Front-desk assistant
  const [existingAssistant] = await db
    .select()
    .from(practitioners)
    .where(
      and(
        eq(practitioners.fullName, ASSISTANT_FULL_NAME),
        eq(practitioners.centerId, center.id)
      )
    );
  const assistant =
    existingAssistant ??
    (
      await db
        .insert(practitioners)
        .values({
          fullName: ASSISTANT_FULL_NAME,
          role: "assistant",
          centerId: center.id,
        })
        .returning()
    )[0];
  console.log(`  front-desk: ${assistant.fullName} (${assistant.id})`);

  // Consultation scenarios
  for (const scenario of REPLAY_SCENARIOS_EN) {
    console.log(`\n→ ${scenario.slug}`);

    const [existingPatient] = await db
      .select()
      .from(patients)
      .where(eq(patients.label, scenario.patientLabel));
    const patient =
      existingPatient ??
      (
        await db
          .insert(patients)
          .values({
            label: scenario.patientLabel,
            age: scenario.patientAge,
            status: scenario.patientStatus,
            centerId: center.id,
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
          centerId: center.id,
        })
        .where(eq(patients.id, patient.id));
    }
    console.log(`  patient: ${patient.label} (${patient.id})`);

    // Wipe prior replay sessions for this patient
    const existingSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.source, "replay"),
          eq(sessions.kind, "consultation"),
          eq(sessions.patientId, patient.id)
        )
      );
    for (const s of existingSessions) {
      await db.delete(sessionScores).where(eq(sessionScores.sessionId, s.id));
      await db
        .delete(coachingInsights)
        .where(eq(coachingInsights.sessionId, s.id));
      await db
        .delete(transcriptLines)
        .where(eq(transcriptLines.sessionId, s.id));
      await db.delete(sessions).where(eq(sessions.id, s.id));
    }

    const [session] = await db
      .insert(sessions)
      .values({
        kind: "consultation",
        source: "replay",
        status: "in_progress",
        analysisStatus: "pending",
        practitionerId: audiologist.id,
        patientId: patient.id,
        durationSeconds: scenario.targetDurationSeconds,
        metadata: { locale: "en" },
      })
      .returning();
    console.log(`  session: ${session.id} [locale=en]`);

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
      `  transcript: ${timed.length} lines, ${mins}m${secs
        .toString()
        .padStart(2, "0")}s`
    );
  }

  // Phone scenarios
  for (const scenario of REPLAY_PHONE_SCENARIOS_EN) {
    console.log(`\n→ ${scenario.slug}`);

    const [existingPatient] = await db
      .select()
      .from(patients)
      .where(eq(patients.label, scenario.callerLabel));
    const patient =
      existingPatient ??
      (
        await db
          .insert(patients)
          .values({
            label: scenario.callerLabel,
            age: scenario.callerAge,
            status: scenario.callerStatus,
            centerId: center.id,
            firstContactAt: new Date(),
          })
          .returning()
      )[0];
    if (existingPatient) {
      await db
        .update(patients)
        .set({
          age: scenario.callerAge,
          status: scenario.callerStatus,
          centerId: center.id,
        })
        .where(eq(patients.id, patient.id));
    }
    console.log(`  caller: ${patient.label} (${patient.id})`);

    const existingSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.source, "replay"),
          eq(sessions.kind, "phone_call"),
          eq(sessions.patientId, patient.id)
        )
      );
    for (const s of existingSessions) {
      await db.delete(sessionScores).where(eq(sessionScores.sessionId, s.id));
      await db
        .delete(coachingInsights)
        .where(eq(coachingInsights.sessionId, s.id));
      await db
        .delete(transcriptLines)
        .where(eq(transcriptLines.sessionId, s.id));
      await db.delete(sessions).where(eq(sessions.id, s.id));
    }

    const [session] = await db
      .insert(sessions)
      .values({
        kind: "phone_call",
        source: "replay",
        status: "in_progress",
        analysisStatus: "pending",
        practitionerId: assistant.id,
        patientId: patient.id,
        durationSeconds: scenario.targetDurationSeconds,
        metadata: { locale: "en" },
      })
      .returning();
    console.log(`  session: ${session.id} [locale=en]`);

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
      `  transcript: ${timed.length} lines, ${mins}m${secs
        .toString()
        .padStart(2, "0")}s`
    );
  }

  await client.end();
  console.log("\n✓ EN replay seeded.");
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
