export const VOYAGE_MODEL = "voyage-3-lite";
export const VOYAGE_DIMENSIONS = 512;
const BATCH_SIZE = 128;
const BASE_DELAY_MS = 350;
const MAX_RETRIES = 6;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

export type EmbedInputType = "document" | "query";

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY manquant");
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type VoyageResponse = {
  data?: { embedding?: number[]; index?: number }[];
  detail?: string;
  error?: { message?: string };
};

async function embedBatch(
  batch: string[],
  inputType: EmbedInputType,
  attempt = 0
): Promise<number[][]> {
  const apiKey = getApiKey();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: batch,
      model: VOYAGE_MODEL,
      input_type: inputType,
    }),
  });

  if (res.status === 429) {
    if (attempt < MAX_RETRIES) {
      const wait = Math.min(60_000, 2_000 * 2 ** attempt);
      console.warn(
        `    ⏳ Voyage 429 — retry #${attempt + 1} dans ${Math.round(wait / 1000)}s`
      );
      await sleep(wait);
      return embedBatch(batch, inputType, attempt + 1);
    }
    throw new Error(`Voyage 429 après ${MAX_RETRIES} retries`);
  }

  const body = (await res.json()) as VoyageResponse;
  if (!res.ok) {
    const msg =
      body.detail ?? body.error?.message ?? `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`Voyage embed échoué : ${msg}`);
  }

  const embeddings = (body.data ?? [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d) => d.embedding ?? []);

  if (embeddings.length !== batch.length) {
    throw new Error(
      `Voyage a renvoyé ${embeddings.length} embeddings pour ${batch.length} textes`
    );
  }

  return embeddings;
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
