import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, asc, eq } from "drizzle-orm";
import {
  sessions,
  patients,
  sessionScores,
  coachingInsights,
} from "../db/schema";
import { REPLAY_SCENARIOS } from "./replay/scripts";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");

  const { retranscribeSession } = await import("../lib/analysis/retranscribe");
  const { analyzeSession } = await import("../lib/analysis/analyze");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  for (const scenario of REPLAY_SCENARIOS) {
    console.log(`\n━━━ ${scenario.slug} (cible ${scenario.targetScore}) ━━━`);

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.label, scenario.patientLabel))
      .limit(1);
    if (!patient) {
      console.error(`  patient absent, run pnpm seed:replay`);
      continue;
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.source, "replay"), eq(sessions.patientId, patient.id)))
      .limit(1);
    if (!session) {
      console.error(`  session absente, run pnpm seed:replay`);
      continue;
    }

    await db
      .delete(sessionScores)
      .where(eq(sessionScores.sessionId, session.id));
    await db
      .delete(coachingInsights)
      .where(eq(coachingInsights.sessionId, session.id));
    await db
      .update(sessions)
      .set({
        analysisStatus: "pending",
        analysisError: null,
        analyzedAt: null,
        globalScore: null,
        summary: null,
        status: "completed",
      })
      .where(eq(sessions.id, session.id));

    const t0 = Date.now();
    const retranscribeOutcome = await retranscribeSession(session.id);
    console.log(`  retranscribe: ${JSON.stringify(retranscribeOutcome)}`);
    const analyzeOutcome = await analyzeSession(session.id);
    const elapsed = Date.now() - t0;
    console.log(
      `  analyze: ${JSON.stringify(analyzeOutcome)} in ${(elapsed / 1000).toFixed(1)}s`
    );

    const [updatedSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id))
      .limit(1);
    const scores = await db
      .select()
      .from(sessionScores)
      .where(eq(sessionScores.sessionId, session.id))
      .orderBy(asc(sessionScores.stepNumber));
    const insights = await db
      .select()
      .from(coachingInsights)
      .where(eq(coachingInsights.sessionId, session.id));

    console.log(
      `  global_score: ${updatedSession.globalScore} (cible ${scenario.targetScore})`
    );
    console.log(
      `  scores: ${scores
        .map((s) => `${s.stepNumber}:${s.score ?? "—"}`)
        .join(" ")}`
    );
    console.log(`  insights: ${insights.length}`);
    for (const i of insights) {
      const eur = i.estimatedImpactEur ? ` [${i.estimatedImpactEur}€]` : "";
      console.log(
        `    - [${i.severity}] ${i.type}${eur} · ét.${i.relatedStep ?? "—"} · ${i.title}`
      );
    }
    if (updatedSession.summary) {
      console.log(`  summary: ${updatedSession.summary.slice(0, 220)}…`);
    }
  }

  await client.end();
  console.log("\n✓ Analyses terminées.");
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
