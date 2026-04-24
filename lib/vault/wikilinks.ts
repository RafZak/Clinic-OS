import "server-only";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Scanne les wikilinks `[[slug]]` ou `[[slug|alias]]` d'un markdown.
 * Retourne la liste dédupliquée des slugs cibles.
 */
export function extractWikilinks(content: string): string[] {
  const set = new Set<string>();
  for (const m of content.matchAll(WIKILINK_RE)) {
    set.add(m[1].trim());
  }
  return Array.from(set);
}

export type ParsedWikilink = {
  full: string;
  slug: string;
  alias: string | null;
  index: number;
  length: number;
};

/**
 * Variante avec positions pour le rendu côté UI (remplacer chaque match par
 * un Link cliquable).
 */
export function parseWikilinks(content: string): ParsedWikilink[] {
  const out: ParsedWikilink[] = [];
  for (const m of content.matchAll(WIKILINK_RE)) {
    out.push({
      full: m[0],
      slug: m[1].trim(),
      alias: m[2]?.trim() ?? null,
      index: m.index ?? 0,
      length: m[0].length,
    });
  }
  return out;
}
