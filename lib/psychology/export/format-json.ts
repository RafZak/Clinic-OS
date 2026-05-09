import type { ExportPayload } from "./types";

/**
 * Sérialise le payload complet en JSON arborescent indenté.
 * Ne ré-encode pas — `buildPatientExportData` produit déjà des dates ISO et
 * des structures sérialisables.
 */
export function formatJson(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}
