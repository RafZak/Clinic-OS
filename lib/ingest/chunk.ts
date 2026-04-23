/**
 * Approximation de token basée sur la longueur caractère : 1 token ≈ 4 caractères
 * en français (légèrement plus que pour l'anglais). Suffisant pour respecter les
 * bornes de chunk voyage-3-lite (32k tokens max par embedding) et contrôler la
 * taille des chunks RAG.
 */
export const CHARS_PER_TOKEN = 4;

export function approxTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export type ChunkOptions = {
  targetTokens?: number; // cible moyenne
  maxTokens?: number; // hard cap
  overlapTokens?: number;
};

/**
 * Chunking sémantique PDF/DOCX : découpe sur les frontières de paragraphe puis
 * de phrase, agrège jusqu'à atteindre targetTokens. Overlap par re-injection des
 * derniers N tokens du chunk précédent.
 */
export function chunkByTokens(
  text: string,
  opts: ChunkOptions = {}
): string[] {
  const target = opts.targetTokens ?? 650;
  const max = opts.maxTokens ?? 800;
  const overlap = opts.overlapTokens ?? 100;

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  // Split en paragraphes puis en phrases pour tolérer les gros paragraphes
  const paragraphs = normalized.split(/\n{2,}/);
  const atoms: string[] = [];
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (approxTokenCount(trimmed) <= max) {
      atoms.push(trimmed);
    } else {
      const sentences = splitSentences(trimmed);
      atoms.push(...sentences);
    }
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const atom of atoms) {
    const atomTokens = approxTokenCount(atom);
    if (currentTokens + atomTokens > target && current.length > 0) {
      chunks.push(current.join("\n\n"));
      if (overlap > 0) {
        // re-injecte le tail du chunk courant pour un overlap souple
        current = tailByTokens(current, overlap);
        currentTokens = approxTokenCount(current.join("\n\n"));
      } else {
        current = [];
        currentTokens = 0;
      }
    }
    current.push(atom);
    currentTokens += atomTokens;
  }

  if (current.length > 0) chunks.push(current.join("\n\n"));
  return chunks;
}

function splitSentences(paragraph: string): string[] {
  // Regex simple FR : . ! ? suivi d'un espace ou fin.
  return paragraph
    .split(/(?<=[\.\!\?])\s+(?=[A-ZÀ-ÖØ-Þ])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tailByTokens(atoms: string[], tokensWanted: number): string[] {
  const out: string[] = [];
  let tokens = 0;
  for (let i = atoms.length - 1; i >= 0; i--) {
    const t = approxTokenCount(atoms[i]);
    if (tokens + t > tokensWanted && out.length > 0) break;
    out.unshift(atoms[i]);
    tokens += t;
  }
  return out;
}

export type VideoSegment = {
  startS: number;
  endS: number;
  text: string;
};

export type VideoChunk = {
  text: string;
  startMs: number;
  endMs: number;
};

/**
 * Chunking vidéo par fenêtres temporelles (30 s par défaut). Agrège les segments
 * Deepgram (par paragraphe ou utterance) jusqu'à atteindre la fenêtre cible,
 * avec un plancher de 10 s pour éviter les chunks trop courts.
 */
export function chunkVideoSegments(
  segments: VideoSegment[],
  windowSeconds = 30,
  minSeconds = 10
): VideoChunk[] {
  if (segments.length === 0) return [];

  const chunks: VideoChunk[] = [];
  let bufferStart = segments[0].startS;
  let bufferEnd = segments[0].endS;
  let bufferText = "";

  for (const seg of segments) {
    if (bufferText === "") {
      bufferStart = seg.startS;
    }
    bufferEnd = seg.endS;
    bufferText += (bufferText ? " " : "") + seg.text.trim();
    if (bufferEnd - bufferStart >= windowSeconds) {
      chunks.push({
        text: bufferText,
        startMs: Math.round(bufferStart * 1000),
        endMs: Math.round(bufferEnd * 1000),
      });
      bufferText = "";
    }
  }

  if (bufferText) {
    // si le dernier buffer est trop court, merge avec l'avant-dernier
    const duration = bufferEnd - bufferStart;
    if (duration < minSeconds && chunks.length > 0) {
      const last = chunks.pop()!;
      chunks.push({
        text: `${last.text} ${bufferText}`.trim(),
        startMs: last.startMs,
        endMs: Math.round(bufferEnd * 1000),
      });
    } else {
      chunks.push({
        text: bufferText,
        startMs: Math.round(bufferStart * 1000),
        endMs: Math.round(bufferEnd * 1000),
      });
    }
  }

  return chunks;
}
