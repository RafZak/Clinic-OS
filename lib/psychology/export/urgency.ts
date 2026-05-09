import type { PatientExportRecord } from "./types";

/**
 * Composante déterministe de l'urgence (0–85). La composante LLM (boost ±15)
 * est ajoutée par-dessus dans build.ts. Toute la logique est documentable
 * pour Amplifon — c'est le 70% reproductible du score 70/30.
 */
export function computeUrgencyBase(
  record: Pick<PatientExportRecord, "radar" | "status" | "tags" | "days_in_pipeline">
): number {
  if (record.status === "lost") return 0;

  let s = 0;
  const r = record.radar;

  // Avancement de la décision (0..30)
  if (r.decisionStage !== null) {
    if (r.decisionStage >= 7) s += 30;
    else if (r.decisionStage >= 5) s += 15;
  }

  // Motivation (0..20)
  if (r.motivation !== null) {
    if (r.motivation >= 7) s += 20;
    else if (r.motivation >= 5) s += 10;
  }

  // Confiance basse → urgence à rassurer (0..10)
  if (r.trust !== null && r.trust <= 4) s += 10;

  // Pipeline qui traîne (0..15)
  if (
    record.status === "prospect" &&
    record.days_in_pipeline !== null &&
    record.days_in_pipeline > 30
  ) {
    s += 15;
  }

  // Bonus tag prospect-chaud (0..10)
  if (record.tags.includes("prospect-chaud")) s += 10;

  return Math.min(85, s);
}

/**
 * Combine la base déterministe avec le boost LLM (±15) et clamp 0..100.
 */
export function combineUrgency(base: number, boost: number): number {
  const safeBoost = Math.max(-15, Math.min(15, Math.round(boost)));
  return Math.max(0, Math.min(100, base + safeBoost));
}
