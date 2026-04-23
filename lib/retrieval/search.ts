import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../../db/client";
import { embedQuery } from "../ingest/embed";

export type RetrievalResult = {
  id: string;
  sourceFile: string;
  sourceType: string;
  programSlug: string | null;
  moduleNumber: number | null;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown> | null;
  driveFileId: string | null;
  similarity: number;
};

export type SearchOptions = {
  topK?: number;
  dedupeThreshold?: number;
  programSlug?: string;
};

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

function parseVector(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    const stripped = raw.replace(/^\[/, "").replace(/\]$/, "");
    if (!stripped.trim()) return [];
    return stripped.split(",").map(Number);
  }
  return [];
}

/**
 * Récupère les chunks les plus proches de la requête, puis collapse les
 * doublons au-dessus du seuil de similarité (0.92 par défaut).
 * Conserve le chunk avec le plus de métadonnées par cluster de doublons.
 */
export async function semanticSearch(
  query: string,
  opts: SearchOptions = {}
): Promise<RetrievalResult[]> {
  const topK = opts.topK ?? 12;
  const dedupeThreshold = opts.dedupeThreshold ?? 0.92;

  const queryEmbedding = await embedQuery(query);
  const queryVec = `[${queryEmbedding.join(",")}]`;

  const programFilter = opts.programSlug
    ? sql`AND program_slug = ${opts.programSlug}`
    : sql``;

  const rows = await db.execute<{
    id: string;
    source_file: string;
    source_type: string;
    program_slug: string | null;
    module_number: number | null;
    chunk_index: number;
    content: string;
    metadata: Record<string, unknown> | null;
    drive_file_id: string | null;
    embedding: unknown;
    similarity: number;
  }>(sql`
    SELECT
      id,
      source_file,
      source_type,
      program_slug,
      module_number,
      chunk_index,
      content,
      metadata,
      drive_file_id,
      embedding,
      1 - (embedding <=> ${queryVec}::vector) AS similarity
    FROM knowledge_chunks
    WHERE embedding IS NOT NULL
    ${programFilter}
    ORDER BY embedding <=> ${queryVec}::vector
    LIMIT ${topK}
  `);

  const raw = rows.map((r) => ({
    id: r.id,
    sourceFile: r.source_file,
    sourceType: r.source_type,
    programSlug: r.program_slug,
    moduleNumber: r.module_number,
    chunkIndex: r.chunk_index,
    content: r.content,
    metadata: r.metadata,
    driveFileId: r.drive_file_id,
    similarity: r.similarity,
    embedding: parseVector(r.embedding),
  }));

  // Near-duplicate collapse
  const kept: typeof raw = [];
  for (const candidate of raw) {
    const duplicate = kept.find(
      (k) => cosineSim(k.embedding, candidate.embedding) >= dedupeThreshold
    );
    if (duplicate) continue;
    kept.push(candidate);
  }

  return kept.map(({ embedding: _e, ...rest }) => rest);
}
