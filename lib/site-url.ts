import "server-only";

/**
 * Résout l'URL absolue du site pour les fetch serveur→serveur.
 *
 * Priorité :
 *   1. NEXT_PUBLIC_SITE_URL (override manuel, ex: domaine custom)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (alias public stable, jamais
 *      bloqué par Vercel Deployment Protection)
 *   3. VERCEL_URL (URL spécifique au déploiement, peut être bloquée
 *      par la deployment protection en prod → fallback uniquement)
 *   4. http://localhost:3000 (dev)
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
