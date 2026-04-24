import type {
  sessions,
  patients,
  transcriptLines,
  sessionScores,
  coachingInsights,
} from "@/db/schema";

export type InsightCitation = {
  id: string;
  sourceFile: string;
  programSlug: string | null;
  moduleNumber: number | null;
  chunkIndex: number;
  similarity: number;
  excerpt: string;
};

export type InsightRow = Omit<typeof coachingInsights.$inferSelect, "citationChunks"> & {
  citationChunks: InsightCitation[] | null;
};

export type ResultsBundle = {
  session: typeof sessions.$inferSelect;
  patient: typeof patients.$inferSelect | null;
  lines: (typeof transcriptLines.$inferSelect)[];
  scores: (typeof sessionScores.$inferSelect)[];
  insights: InsightRow[];
};
