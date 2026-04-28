import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../../db/client";
import { embedQuery } from "../ingest/embed";

export type RetrievalResult = {
  id: string;
  sourceFile: string;
  sourceType: string;
  programSlug: string | null;
  programTitle: string | null;
  moduleNumber: number | null;
  moduleTitle: string | null;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown> | null;
  driveFileId: string | null;
  startSeconds: number | null;
  pageNumber: number | null;
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
    ? sql`AND kc.program_slug = ${opts.programSlug}`
    : sql``;

  const rows = await db.execute<{
    id: string;
    source_file: string;
    source_type: string;
    program_slug: string | null;
    program_title: string | null;
    module_number: number | null;
    module_title: string | null;
    chunk_index: number;
    content: string;
    metadata: Record<string, unknown> | null;
    drive_file_id: string | null;
    start_seconds: number | null;
    page_number: number | null;
    embedding: unknown;
    similarity: number;
  }>(sql`
    SELECT
      kc.id,
      kc.source_file,
      kc.source_type,
      kc.program_slug,
      p.title AS program_title,
      kc.module_number,
      m.title AS module_title,
      kc.chunk_index,
      kc.content,
      kc.metadata,
      kc.drive_file_id,
      (kc.metadata->>'startSeconds')::float AS start_seconds,
      (kc.metadata->>'pageNumber')::int AS page_number,
      kc.embedding,
      1 - (kc.embedding <=> ${queryVec}::vector) AS similarity
    FROM knowledge_chunks kc
    LEFT JOIN programs p ON p.slug = kc.program_slug
    LEFT JOIN modules m ON m.program_id = p.id AND m.number = kc.module_number
    WHERE kc.embedding IS NOT NULL
    ${programFilter}
    ORDER BY kc.embedding <=> ${queryVec}::vector
    LIMIT ${topK}
  `);

  const raw = rows.map((r) => ({
    id: r.id,
    sourceFile: r.source_file,
    sourceType: r.source_type,
    programSlug: r.program_slug,
    programTitle: r.program_title ?? null,
    moduleNumber: r.module_number,
    moduleTitle: r.module_title ?? null,
    chunkIndex: r.chunk_index,
    content: r.content,
    metadata: r.metadata,
    driveFileId: r.drive_file_id,
    startSeconds: r.start_seconds ?? null,
    pageNumber: r.page_number ?? null,
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
