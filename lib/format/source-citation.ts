import type { Locale } from "@/lib/locale";

export type SourceCitationInput = {
  programTitle: string | null;
  moduleNumber: number | null;
  moduleTitle: string | null;
  /** Pour vidéos : timestamp en secondes du début du chunk */
  startSeconds?: number | null;
  /** Pour PDF : numéro de page */
  pageNumber?: number | null;
  /** sourceType pour décider si on affiche le timestamp/page */
  sourceType?: string | null;
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Formate une source de citation pour l'UI utilisateur final.
 * Ex: "Audio Vente · Module 3 — L'accord patient · 02:47"
 *     "Personnel accueil · Module 1"
 *     "Audio Vente · Module 3 — L'accord patient · p. 12"
 */
export function formatSourceCitation(
  input: SourceCitationInput,
  locale: Locale = "fr"
): string {
  const parts: string[] = [];

  if (input.programTitle) parts.push(input.programTitle);

  if (input.moduleNumber != null) {
    const moduleLabel = `Module ${input.moduleNumber}`;
    if (input.moduleTitle) {
      parts.push(`${moduleLabel} — ${input.moduleTitle}`);
    } else {
      parts.push(moduleLabel);
    }
  }

  const head = parts.join(" · ");

  if (input.sourceType === "video_transcript" && input.startSeconds != null) {
    return `${head} · ${formatTimestamp(input.startSeconds)}`;
  }
  if (input.sourceType === "pdf" && input.pageNumber != null) {
    return `${head} · p. ${input.pageNumber}`;
  }

  return head;
}
