import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import {
  sessions,
  patients,
  sessionScores,
  coachingInsights,
} from "../db/schema";
import { REPLAY_PHONE_SCENARIOS } from "./replay/scripts-phone";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");

  const { retranscribeSession } = await import("../lib/analysis/retranscribe");
  const { analyzeSession } = await import("../lib/analysis/analyze");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  for (const scenario of REPLAY_PHONE_SCENARIOS) {
    console.log(`\n━━━ ${scenario.slug} (cible ${scenario.targetScore}) ━━━`);
    const t0 = Date.now();

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.label, scenario.callerLabel))
      .limit(1);
    if (!patient) {
      console.error(`  appelant absent, run pnpm seed:replay-phone`);
      continue;
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.source, "replay"),
          eq(sessions.patientId, patient.id),
          eq(sessions.kind, "phone_call")
        )
      )
      .limit(1);
    if (!session) {
      console.error(`  session absente, run pnpm seed:replay-phone`);
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
        metadata: null,
      })
      .where(eq(sessions.id, session.id));

    console.log(`  retranscribe…`);
    await retranscribeSession(session.id);

    console.log(`  analyze…`);
    const result = await analyzeSession(session.id);

    await db
      .update(sessions)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(sessions.id, session.id));
    if ("ok" in result && result.ok) {
      console.log(
        `  ✓ score ${result.globalScore}/100 (cible ${scenario.targetScore}, delta ${result.globalScore - scenario.targetScore}), insights ${result.insights}`
      );
    } else if ("skipped" in result) {
      console.log(`  ✗ skipped: ${result.skipped}`);
    }

    const [updated] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id))
      .limit(1);
    const tags =
      updated.metadata && typeof updated.metadata === "object"
        ? (updated.metadata as { tags?: unknown }).tags
        : null;
    console.log(`  tags:`, tags);

    const insights = await db
      .select()
      .from(coachingInsights)
      .where(eq(coachingInsights.sessionId, session.id));
    for (const i of insights) {
      const impact = i.estimatedImpactEur ? ` (${i.estimatedImpactEur} €)` : "";
      console.log(`    [${i.severity}] ${i.type} — ${i.title}${impact}`);
    }

    console.log(`  ⏱ ${Math.round((Date.now() - t0) / 100) / 10}s`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
