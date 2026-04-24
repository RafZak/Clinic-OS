import { REPLAY_SCENARIOS, computeTimedLines } from "./scripts";

for (const s of REPLAY_SCENARIOS) {
  const timed = computeTimedLines(s.turns);
  const last = timed[timed.length - 1];
  const totalSec = Math.round(last.endMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  console.log(`${s.slug}: ${s.turns.length} turns, ${min}m${sec.toString().padStart(2, "0")}s, target ${s.targetScore}`);
}
