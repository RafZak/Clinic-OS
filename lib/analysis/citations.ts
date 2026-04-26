import "server-only";
import { semanticSearch } from "@/lib/retrieval/search";
import { isMasterFile } from "@/lib/knowledge/master";
import type { InsightCitation } from "@/lib/types/analysis";

export type { InsightCitation };

type InsightLike = {
  title: string;
  description: string;
};

/**
 * Pour chaque insight, attache 1-2 chunks Layer A les plus pertinents.
 * Best-effort : si le retrieval échoue pour un insight, citationChunks=null.
 * Les fichiers Master* sont conservés en mémoire mais exclus des citations
 * affichées à l'utilisateur.
 */
export async function enrichInsightsWithCitations<T extends InsightLike>(
  insights: T[]
): Promise<(T & { citationChunks: InsightCitation[] | null })[]> {
  const out: (T & { citationChunks: InsightCitation[] | null })[] = [];
  for (const insight of insights) {
    const query = `${insight.title}. ${insight.description}`.slice(0, 500);
    try {
      const results = await semanticSearch(query, { topK: 6, dedupeThreshold: 0.9 });
      const citations: InsightCitation[] = results
        .filter((r) => r.similarity >= 0.35)
        .filter((r) => !isMasterFile(r.sourceFile))
        .slice(0, 2)
        .map((r) => ({
          id: r.id,
          sourceFile: r.sourceFile,
          sourceType: r.sourceType,
          driveFileId: r.driveFileId,
          programSlug: r.programSlug,
          moduleNumber: r.moduleNumber,
          chunkIndex: r.chunkIndex,
          similarity: Number(r.similarity.toFixed(3)),
          excerpt: r.content.slice(0, 280),
        }));
      out.push({ ...insight, citationChunks: citations.length > 0 ? citations : null });
    } catch (err) {
      console.warn("citation fetch failed for insight", insight.title, err);
      out.push({ ...insight, citationChunks: null });
    }
  }
  return out;
}
