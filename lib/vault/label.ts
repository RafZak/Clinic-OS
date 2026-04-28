const STOPWORDS_FR = new Set(["de", "du", "des", "le", "la", "les", "et", "à", "au", "aux", "un", "une"]);

/**
 * Humanise un slug kebab-case en label lisible métier.
 * Ex: "objection-prix-non-traitee" → "Objection prix non traitée"
 *     "lyon-3" → "Lyon 3"
 *     "jonathan-goldminc" → "Jonathan Goldminc"
 */
export function humanizeSlug(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length === 0) return slug;
  return parts
    .map((p, i) => {
      if (i > 0 && STOPWORDS_FR.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

/**
 * Résout un slug en label affichable. Préfère le titre indexé en base
 * (pageIndex), sinon humanise le slug.
 */
export function resolveSlugLabel(
  slug: string,
  alias: string | null,
  pageIndex: { slug: string; title?: string }[]
): string {
  if (alias) return alias;
  const indexed = pageIndex.find((p) => p.slug === slug);
  if (indexed?.title) return indexed.title;
  return humanizeSlug(slug);
}
