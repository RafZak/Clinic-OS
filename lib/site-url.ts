import "server-only";

/**
 * Résout l'URL absolue du site pour les fetch serveur→serveur.
 * Priorité :
 *   1. NEXT_PUBLIC_SITE_URL (override manuel, ex: domaine custom en prod)
 *   2. VERCEL_URL (fourni automatiquement par Vercel, sans scheme)
 *   3. http://localhost:3000 (dev)
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
