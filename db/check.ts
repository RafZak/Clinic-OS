import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const client = postgres(process.env.DATABASE_URL, { max: 1 });

  const tables = await client<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const vectorExt = await client<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname = 'vector'
  `;

  console.log(`\npgvector extension: ${vectorExt.length ? "✓ enabled" : "✗ MISSING"}`);
  console.log(`Tables (${tables.length}):`);
  tables.forEach((t) => console.log(`  - ${t.table_name}`));

  await client.end();
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
