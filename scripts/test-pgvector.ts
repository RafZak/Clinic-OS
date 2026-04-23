import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

config({ path: ".env.local" });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });

  const embedding = Array.from({ length: 1024 }, () => Math.random() - 0.5);

  try {
    const [row] = await db
      .insert(schema.knowledgeChunks)
      .values({
        sourceFile: "test-pgvector.pdf",
        sourceType: "pdf",
        programSlug: "reference",
        moduleNumber: 1,
        chunkIndex: 0,
        content: "Test chunk content.",
        metadata: { test: true },
        embedding,
        driveFileId: "test-drive-id-pgvector",
        driveModifiedAt: new Date(),
      })
      .returning({ id: schema.knowledgeChunks.id });

    console.log(`✓ Insert réussi. Row id: ${row.id}`);

    // Nettoyage
    await db
      .delete(schema.knowledgeChunks)
      .where(eq(schema.knowledgeChunks.driveFileId, "test-drive-id-pgvector"));
    console.log("✓ Cleanup OK");
  } catch (err) {
    console.error("✗ Insert failed:");
    if (err instanceof Error) {
      console.error("  message:", err.message);
      console.error("  name:", err.name);
      if ("code" in err) console.error("  code:", (err as { code: string }).code);
      if ("detail" in err) console.error("  detail:", (err as { detail: string }).detail);
    } else {
      console.error(err);
    }
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
