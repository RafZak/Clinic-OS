import type {
  sessions,
  patients,
  transcriptLines,
  sessionScores,
  coachingInsights,
  sessionArtifacts,
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

export type ArtifactType =
  | "clinical_notes"
  | "patient_email"
  | "patient_sms"
  | "orl_letter";

export type ArtifactRow = typeof sessionArtifacts.$inferSelect & { type: ArtifactType };

export type VaultLink = {
  path: string;
  title: string;
  updatedAt: Date | null;
};

export type ResultsBundle = {
  session: typeof sessions.$inferSelect;
  patient: typeof patients.$inferSelect | null;
  lines: (typeof transcriptLines.$inferSelect)[];
  scores: (typeof sessionScores.$inferSelect)[];
  insights: InsightRow[];
  artifacts: ArtifactRow[];
  practitionerVault: VaultLink | null;
  sessionVault: VaultLink | null;
};
