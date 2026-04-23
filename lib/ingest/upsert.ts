import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../db/schema";
import type { ExtractedDocument } from "../drive/extract";

export type IngestChunkRow = {
  sourceFile: string;
  sourceType: "pdf" | "video_transcript" | "docx";
  programSlug: string | null;
  moduleNumber: number | null;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown> | null;
  driveFileId: string;
  driveModifiedAt: Date;
};

export async function existingChunkMeta(
  db: PostgresJsDatabase<typeof schema>,
  driveFileId: string
): Promise<{ count: number; modifiedAt: Date | null }> {
  const rows = await db
    .select({
      modifiedAt: schema.knowledgeChunks.driveModifiedAt,
    })
    .from(schema.knowledgeChunks)
    .where(eq(schema.knowledgeChunks.driveFileId, driveFileId));
  return {
    count: rows.length,
    modifiedAt: rows[0]?.modifiedAt ?? null,
  };
}

export async function replaceChunksForFile(
  db: PostgresJsDatabase<typeof schema>,
  driveFileId: string,
  rows: IngestChunkRow[]
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.knowledgeChunks)
      .where(eq(schema.knowledgeChunks.driveFileId, driveFileId));
    if (rows.length > 0) {
      // Insert by batches of 200 to stay under parameter limits
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        await tx.insert(schema.knowledgeChunks).values(rows.slice(i, i + BATCH));
      }
    }
  });
}

export function buildChunkRows(
  doc: ExtractedDocument,
  opts: {
    sourceFile: string;
    programSlug: string;
    moduleNumber?: number;
    driveFileId: string;
    driveModifiedAt: Date;
    embeddings: number[][];
    extraMeta?: Record<string, unknown>;
  }
): IngestChunkRow[] {
  if (doc.chunks.length !== opts.embeddings.length) {
    throw new Error(
      `Mismatch chunks/embeddings : ${doc.chunks.length} vs ${opts.embeddings.length}`
    );
  }

  return doc.chunks.map((chunk, i) => {
    const metadata: Record<string, unknown> = {
      ...(opts.extraMeta ?? {}),
      ...(chunk.metadata ?? {}),
    };
    if (chunk.startMs !== undefined) metadata.startMs = chunk.startMs;
    if (chunk.endMs !== undefined) metadata.endMs = chunk.endMs;

    return {
      sourceFile: opts.sourceFile,
      sourceType: doc.sourceType,
      programSlug: opts.programSlug,
      moduleNumber: opts.moduleNumber ?? null,
      chunkIndex: chunk.chunkIndex,
      content: chunk.text,
      embedding: opts.embeddings[i],
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      driveFileId: opts.driveFileId,
      driveModifiedAt: opts.driveModifiedAt,
    };
  });
}
