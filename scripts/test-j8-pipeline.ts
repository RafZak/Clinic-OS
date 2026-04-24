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
  sessionArtifacts,
  vaultPages,
} from "../db/schema";
import { REPLAY_SCENARIOS } from "./replay/scripts";

const TARGET_SLUG = process.argv[2] ?? "durand-excellent";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");

  const scenario = REPLAY_SCENARIOS.find((s) => s.slug === TARGET_SLUG);
  if (!scenario) {
    console.error(
      `Scénario "${TARGET_SLUG}" introuvable. Disponibles: ${REPLAY_SCENARIOS.map((s) => s.slug).join(", ")}`
    );
    process.exit(1);
  }

  const { retranscribeSession } = await import("../lib/analysis/retranscribe");
  const { analyzeSession } = await import("../lib/analysis/analyze");
  const { generateAllArtifacts } = await import("../lib/artifacts/generate");
  const { updateVaultForSession } = await import("../lib/vault/ingest");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log(`\n━━━ J8 E2E PIPELINE — ${scenario.slug} ━━━\n`);

  // Resolve session
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.label, scenario.patientLabel))
    .limit(1);
  if (!patient) {
    console.error("✗ Patient introuvable. Lancez pnpm seed:replay.");
    process.exit(1);
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.source, "replay"), eq(sessions.patientId, patient.id)))
    .limit(1);
  if (!session) {
    console.error("✗ Session introuvable. Lancez pnpm seed:replay.");
    process.exit(1);
  }

  // Reset
  console.log("→ Reset session state");
  await db.delete(sessionScores).where(eq(sessionScores.sessionId, session.id));
  await db.delete(coachingInsights).where(eq(coachingInsights.sessionId, session.id));
  await db.delete(sessionArtifacts).where(eq(sessionArtifacts.sessionId, session.id));
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

  // Étape 1 : retranscribe + analyze
  console.log("\n[1/3] Retranscribe + Analyze (Sonnet 4.6)");
  const t1 = Date.now();
  await retranscribeSession(session.id);
  const analyzeOutcome = await analyzeSession(session.id);
  const t1Elapsed = Date.now() - t1;
  console.log(`  done in ${(t1Elapsed / 1000).toFixed(1)}s — ${JSON.stringify(analyzeOutcome)}`);

  // Étape 2 : artefacts (parallèle)
  console.log("\n[2/3] Artefacts (4 generators en parallèle)");
  const t2 = Date.now();
  const artifactResults = await generateAllArtifacts(session.id);
  const t2Elapsed = Date.now() - t2;
  console.log(`  total: ${(t2Elapsed / 1000).toFixed(1)}s`);
  for (const r of artifactResults) {
    if (r.ok) {
      console.log(`    ✓ ${r.type} — ${(r.durationMs / 1000).toFixed(1)}s`);
    } else {
      console.log(`    ✗ ${r.type} — ${r.error}`);
    }
  }

  // Étape 3 : vault update
  console.log("\n[3/3] Vault update (Sonnet 4.6 emit_vault_updates)");
  const t3 = Date.now();
  const vaultResult = await updateVaultForSession(session.id);
  const t3Elapsed = Date.now() - t3;
  if (vaultResult.ok) {
    console.log(`  ✓ ${vaultResult.patches} patches appliqués en ${(t3Elapsed / 1000).toFixed(1)}s`);
  } else {
    console.log(`  ✗ ${vaultResult.error}`);
  }

  // Récap final : lecture DB
  console.log("\n━━━ ÉTAT FINAL ━━━");

  const [finalSession] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, session.id))
    .limit(1);
  console.log(
    `Session : score global ${finalSession.globalScore} (cible ${scenario.targetScore}), status ${finalSession.analysisStatus}`
  );
  console.log(`Summary : ${finalSession.summary?.slice(0, 200) ?? "—"}…`);

  const finalArtifacts = await db
    .select()
    .from(sessionArtifacts)
    .where(eq(sessionArtifacts.sessionId, session.id));
  console.log(`Artefacts : ${finalArtifacts.length}/4 persistés`);
  for (const a of finalArtifacts) {
    const meta = (a.metadata as { durationMs?: number; inputTokens?: number; outputTokens?: number }) ?? {};
    console.log(
      `  - ${a.type} : ${a.content.length} chars · ${meta.durationMs ? (meta.durationMs / 1000).toFixed(1) : "?"}s · ${meta.inputTokens ?? "?"}+${meta.outputTokens ?? "?"} tokens`
    );
  }

  const vaultRows = await db
    .select({ path: vaultPages.path, kind: vaultPages.kind, updatedAt: vaultPages.updatedAt })
    .from(vaultPages)
    .orderBy(asc(vaultPages.path));
  const recent = vaultRows.filter(
    (r) => r.updatedAt && Date.now() - new Date(r.updatedAt).getTime() < 60_000
  );
  console.log(`Vault : ${vaultRows.length} fiches au total, ${recent.length} touchées dans la dernière minute`);
  for (const r of recent) {
    console.log(`  ↻ ${r.path} (${r.kind})`);
  }

  console.log(
    `\nTotal pipeline : ${((t1Elapsed + t2Elapsed + t3Elapsed) / 1000).toFixed(1)}s`
  );

  await client.end();
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
