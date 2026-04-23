"use server";

import { semanticSearch, type RetrievalResult } from "@/lib/retrieval/search";

export type SearchState = {
  query: string;
  results: RetrievalResult[];
  error?: string;
  durationMs?: number;
};

export async function runRetrievalTest(
  _prevState: SearchState | null,
  formData: FormData
): Promise<SearchState> {
  const query = (formData.get("query") as string | null)?.trim() ?? "";
  if (!query) {
    return { query: "", results: [], error: "Requête vide." };
  }

  const started = Date.now();
  try {
    const results = await semanticSearch(query, { topK: 12 });
    return {
      query,
      results,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      query,
      results: [],
      error: msg,
      durationMs: Date.now() - started,
    };
  }
}
