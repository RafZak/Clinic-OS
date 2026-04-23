import { VoyageAIClient } from "voyageai";

export const VOYAGE_MODEL = "voyage-3-lite";
export const VOYAGE_DIMENSIONS = 512;
const BATCH_SIZE = 128;
const BASE_DELAY_MS = 350; // pacing entre batches sur l'API Voyage
const MAX_RETRIES = 6;

let cached: VoyageAIClient | null = null;
function getClient(): VoyageAIClient {
  if (cached) return cached;
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY manquant");
  cached = new VoyageAIClient({ apiKey });
  return cached;
}

export type EmbedInputType = "document" | "query";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { statusCode?: number; status?: number; message?: string };
  if (e.statusCode === 429 || e.status === 429) return true;
  if (typeof e.message === "string" && /429|rate.?limit|Too Many Requests/i.test(e.message)) {
    return true;
  }
  return false;
}

function summarizeError(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode ? ` (HTTP ${e.statusCode})` : "";
    return `${e.message}${code}`;
  }
  return String(err);
}

async function embedBatch(
  batch: string[],
  inputType: EmbedInputType,
  attempt = 0
): Promise<number[][]> {
  try {
    const response = await getClient().embed({
      input: batch,
      model: VOYAGE_MODEL,
      inputType,
    });
    const embeddings = response.data?.map((d) => d.embedding ?? []) ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Voyage a renvoyé ${embeddings.length} embeddings pour ${batch.length} textes`
      );
    }
    return embeddings;
  } catch (err) {
    if (attempt < MAX_RETRIES && isRateLimitError(err)) {
      const wait = Math.min(60_000, 2_000 * 2 ** attempt);
      console.warn(
        `    ⏳ Voyage 429 — retry #${attempt + 1} dans ${Math.round(wait / 1000)}s`
      );
      await sleep(wait);
      return embedBatch(batch, inputType, attempt + 1);
    }
    throw new Error(`Voyage embed échoué : ${summarizeError(err)}`);
  }
}

export async function embedTexts(
  texts: string[],
  inputType: EmbedInputType = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch, inputType);
    out.push(...embeddings);
    if (i + BATCH_SIZE < texts.length) await sleep(BASE_DELAY_MS);
  }

  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text], "query");
  return vec;
}
