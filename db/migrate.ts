import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(process.env.DATABASE_URL, { max: 1 });

  console.log("→ Ensuring pgvector extension is enabled");
  await client.unsafe("CREATE EXTENSION IF NOT EXISTS vector");

  console.log("→ Running Drizzle migrations");
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("✓ Migrations applied");
  await client.end();
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
