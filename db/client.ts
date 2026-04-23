import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPostgres = globalThis as unknown as {
  postgres: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForPostgres.postgres ??
  postgres(process.env.DATABASE_URL, {
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.postgres = client;
}

export const db = drizzle(client, { schema });
export { schema };
