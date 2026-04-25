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
import { REPLAY_PHONE_SCENARIOS, computeTimedLines } from "./replay/scripts-phone";

config({ path: ".env.local" });

const CENTER_NAME = "Lyon 3";
const ASSISTANT_FULL_NAME = "Sophie Bernard";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("→ Seed replay appels entrants");

  const [center] = await db
    .select()
    .from(centers)
    .where(eq(centers.name, CENTER_NAME));
  if (!center) {
    throw new Error(
      `Centre ${CENTER_NAME} absent — exécuter pnpm seed:replay d'abord`
    );
  }
  console.log(`  centre: ${center.name} (${center.id})`);

  let assistantRow = (
    await db
      .select()
      .from(practitioners)
      .where(
        and(
          eq(practitioners.fullName, ASSISTANT_FULL_NAME),
          eq(practitioners.centerId, center.id)
        )
      )
  )[0];
  if (!assistantRow) {
    [assistantRow] = await db
      .insert(practitioners)
      .values({
        fullName: ASSISTANT_FULL_NAME,
        role: "assistant",
        centerId: center.id,
      })
      .returning();
    console.log(
      `  assistant: ${assistantRow.fullName} (${assistantRow.id}) [créé]`
    );
  } else {
    console.log(`  assistant: ${assistantRow.fullName} (${assistantRow.id})`);
  }

  for (const scenario of REPLAY_PHONE_SCENARIOS) {
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
    console.log(`  appelant: ${patient.label} (${patient.id})`);

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
      await db.delete(transcriptLines).where(eq(transcriptLines.sessionId, s.id));
      await db.delete(sessions).where(eq(sessions.id, s.id));
    }

    const [session] = await db
      .insert(sessions)
      .values({
        kind: "phone_call",
        source: "replay",
        status: "in_progress",
        analysisStatus: "pending",
        practitionerId: assistantRow.id,
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
  console.log("\n✓ Replay appels entrants seedés.");
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
