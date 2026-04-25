import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function main() {
  const url = process.env.DATABASE_URL!;
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS module_progress (
      role text NOT NULL,
      drive_file_id text NOT NULL,
      watched_seconds int NOT NULL DEFAULT 0,
      duration_seconds int,
      completed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (role, drive_file_id),
      CONSTRAINT module_progress_role_check CHECK (role in ('audioprothesiste', 'assistant'))
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS module_progress_role_idx ON module_progress(role)
  `);

  console.log("module_progress table OK");
  await client.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
