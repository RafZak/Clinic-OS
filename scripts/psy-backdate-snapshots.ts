/**
 * Aligne le created_at de chaque snapshot psy sur le started_at de sa session.
 * Sinon tous les snapshots ont la même date (celle du rescore batch) et la
 * timeline du radar perd son sens. Idempotent.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

(async () => {
  const { db } = await import("../db/client");
  const { sql } = await import("drizzle-orm");

  const result = await db.execute(sql`
    UPDATE session_psychology_snapshots sps
    SET created_at = COALESCE(s.started_at, sps.created_at)
    FROM sessions s
    WHERE s.id = sps.session_id
      AND s.started_at IS NOT NULL
  `);

  const [{ count }] = (await db.execute(sql`
    SELECT count(*)::int AS count FROM session_psychology_snapshots
  `)) as unknown as Array<{ count: number }>;

  console.log("Backdated snapshots aligned with session.started_at");
  console.log(`Total snapshots: ${count}`);
  process.exit(0);
})();
