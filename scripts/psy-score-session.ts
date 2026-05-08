import { config } from "dotenv";
// override:true pour écraser les éventuelles vars vides dans l'env du shell
// (sinon ANTHROPIC_API_KEY="" du shell prend le pas sur .env.local)
config({ path: ".env.local", override: true });

const sessionId = process.argv[2];

if (!sessionId) {
  console.error("Usage: pnpm psy:score-session <session_id> [--persist]");
  console.error("Par défaut, mode dry-run (n'écrit rien en DB).");
  process.exit(1);
}

const persist = process.argv.includes("--persist");

(async () => {
  // Import dynamique pour s'assurer que dotenv s'exécute AVANT le chargement
  // de db/client (qui throw si DATABASE_URL absent au import time).
  const { scorePatientPsychology } = await import(
    "../lib/psychology/score-session"
  );
  const t0 = Date.now();
  console.log(`Scoring session ${sessionId} (${persist ? "persist" : "dry-run"})...`);
  try {
    const result = await scorePatientPsychology(sessionId, { dryRun: !persist });
    if ("skipped" in result) {
      console.log(`SKIPPED: ${result.skipped}`);
      process.exit(0);
    }
    console.log(`\n✓ Scoring OK (${Math.round((Date.now() - t0) / 1000)}s)`);
    console.log("\n--- Radar 6 axes ---");
    for (const [axis, score] of Object.entries(result.radar)) {
      const bar = score === null ? "(non observé)" : "█".repeat(score) + "░".repeat(10 - score);
      console.log(`  ${axis.padEnd(20)} ${score === null ? "  -" : String(score).padStart(3)} ${bar}`);
    }
    console.log(`\n--- Tags dérivés (${result.tags.length}) ---`);
    if (result.tags.length === 0) console.log("  (aucun)");
    else result.tags.forEach((t) => console.log(`  • ${t}`));
    console.log(`\n--- Snapshot ID ---`);
    console.log(`  ${result.snapshotId}`);
    if (!persist) {
      console.log(`\n[dry-run] Aucune écriture en DB. Ajouter --persist pour persister.`);
    }
  } catch (err) {
    console.error("\n✗ ERREUR:", err);
    process.exit(1);
  }
})();
