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
    CREATE TABLE IF NOT EXISTS quiz_sets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      program_slug text NOT NULL,
      module_number int,
      ordinal int NOT NULL,
      title text NOT NULL,
      pass_threshold int NOT NULL DEFAULT 80,
      source_file text NOT NULL,
      created_at timestamptz DEFAULT now(),
      CONSTRAINT quiz_sets_program_ordinal_uniq UNIQUE (program_slug, ordinal)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS quiz_sets_program_idx ON quiz_sets(program_slug, ordinal)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_set_id uuid NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
      position int NOT NULL,
      prompt text NOT NULL,
      kind text NOT NULL,
      choices jsonb NOT NULL,
      correct_ids text[] NOT NULL,
      explanation text NOT NULL,
      related_module int,
      CONSTRAINT quiz_questions_set_position_uniq UNIQUE (quiz_set_id, position),
      CONSTRAINT quiz_questions_kind_check CHECK (kind in ('single', 'multi', 'boolean'))
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_set_id uuid NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
      practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
      score int NOT NULL,
      passed boolean NOT NULL,
      answers jsonb NOT NULL,
      duration_ms int,
      completed_at timestamptz DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS quiz_attempts_practitioner_idx ON quiz_attempts(practitioner_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS quiz_attempts_set_idx ON quiz_attempts(quiz_set_id)
  `);

  console.log("quiz tables OK");
  await client.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
