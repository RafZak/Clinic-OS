/**
 * 6 axes psychologiques scorés par l'IA depuis le transcript de chaque session.
 * Échelle 0-10. Score null si l'axe n'est pas observable dans la session.
 * Cf. spec: docs/superpowers/specs/2026-05-08-patient-psychology-design.md §3
 */

export const PSY_AXES = [
  "acceptance",
  "motivation",
  "trust",
  "priceSensitivity",
  "externalInfluence",
  "decisionStage",
] as const;

export type PsyAxis = (typeof PSY_AXES)[number];

export const PSY_AXIS_LABEL: Record<PsyAxis, string> = {
  acceptance: "Acceptation déficit",
  motivation: "Motivation",
  trust: "Confiance pro",
  priceSensitivity: "Sensibilité prix",
  externalInfluence: "Influence entourage",
  decisionStage: "Stade décisionnel",
};

/** Labels courts pour affichage sur le radar SVG (place limitée). */
export const PSY_AXIS_SHORT_LABEL: Record<PsyAxis, string> = {
  acceptance: "Acceptation",
  motivation: "Motivation",
  trust: "Confiance",
  priceSensitivity: "Prix",
  externalInfluence: "Entourage",
  decisionStage: "Décision",
};

export const PSY_AXIS_SHORT_LABEL_EN: Record<PsyAxis, string> = {
  acceptance: "Acceptance",
  motivation: "Motivation",
  trust: "Trust",
  priceSensitivity: "Price",
  externalInfluence: "Influence",
  decisionStage: "Decision",
};

/**
 * Polarité de chaque axe pour la lecture du radar :
 *  - "positive" → haut sur le radar = signal FAVORABLE pour la vente
 *    (ex: motivation, acceptation, confiance, stade décisionnel)
 *  - "negative" → haut sur le radar = signal DÉFAVORABLE / point de friction
 *    (ex: sensibilité prix élevée = réfractaire ; influence entourage forte
 *    = décision dépendante d'un tiers)
 *
 * Affiché à côté du label pour lever l'ambiguïté ("Prix +" vs "Prix −").
 */
export type PsyAxisPolarity = "positive" | "negative";

export const PSY_AXIS_POLARITY: Record<PsyAxis, PsyAxisPolarity> = {
  acceptance: "positive",
  motivation: "positive",
  trust: "positive",
  priceSensitivity: "negative",
  externalInfluence: "negative",
  decisionStage: "positive",
};

/**
 * Interprétation lisible de chaque axe selon le niveau de score.
 * "low" = score 0-3, "mid" = 4-6, "high" = 7-10.
 * Permet d'afficher "Prix 8/10 — réfractaire" plutôt que de laisser
 * l'utilisateur deviner la sémantique du score.
 */
type Tier = "low" | "mid" | "high";

export function tierFor(score: number): Tier {
  if (score <= 3) return "low";
  if (score <= 6) return "mid";
  return "high";
}

export const PSY_AXIS_INTERPRETATION: Record<PsyAxis, Record<Tier, string>> = {
  acceptance: {
    low: "en déni / refuse le déficit",
    mid: "ambivalent",
    high: "accepte son déficit auditif",
  },
  motivation: {
    low: "peu engagé / passif",
    mid: "modérément motivé",
    high: "très motivé / moteur",
  },
  trust: {
    low: "méfiant envers le pro",
    mid: "neutre",
    high: "très confiant envers le pro",
  },
  priceSensitivity: {
    low: "peu sensible au prix",
    mid: "sensibilité prix modérée",
    high: "très sensible au prix / frein financier",
  },
  externalInfluence: {
    low: "autonome dans sa décision",
    mid: "écoute son entourage",
    high: "décision dépend fortement de l'entourage",
  },
  decisionStage: {
    low: "phase d'exploration / pas prêt",
    mid: "réfléchit, hésite",
    high: "prêt à décider / signature proche",
  },
};

export const PSY_AXIS_INTERPRETATION_EN: Record<PsyAxis, Record<Tier, string>> = {
  acceptance: {
    low: "in denial / refuses the deficit",
    mid: "ambivalent",
    high: "accepts hearing loss",
  },
  motivation: {
    low: "uninvested / passive",
    mid: "moderately motivated",
    high: "highly motivated / driving force",
  },
  trust: {
    low: "distrustful of the practitioner",
    mid: "neutral",
    high: "highly trusts the practitioner",
  },
  priceSensitivity: {
    low: "not price-sensitive",
    mid: "moderate price sensitivity",
    high: "highly price-sensitive / financial barrier",
  },
  externalInfluence: {
    low: "decides autonomously",
    mid: "considers their entourage",
    high: "decision strongly depends on entourage",
  },
  decisionStage: {
    low: "exploration phase / not ready",
    mid: "considering, hesitating",
    high: "ready to decide / signature near",
  },
};

export function interpretAxis(
  axis: PsyAxis,
  score: number,
  locale: "fr" | "en" = "fr"
): string {
  const map = locale === "en" ? PSY_AXIS_INTERPRETATION_EN : PSY_AXIS_INTERPRETATION;
  return map[axis][tierFor(score)];
}

export const PSY_AXIS_LABEL_EN: Record<PsyAxis, string> = {
  acceptance: "Hearing loss acceptance",
  motivation: "Motivation",
  trust: "Practitioner trust",
  priceSensitivity: "Price sensitivity",
  externalInfluence: "External influence",
  decisionStage: "Decision stage",
};

export const PSY_AXIS_DESCRIPTION: Record<PsyAxis, string> = {
  acceptance:
    "Reconnaissance et acceptation du problème auditif (0 = déni, 10 = pleinement accepté)",
  motivation:
    "Énergie d'engagement dans le traitement (0 = passif, 10 = moteur)",
  trust:
    "Niveau de confiance accordé à l'audioprothésiste (0 = méfiance, 10 = confiance totale)",
  priceSensitivity:
    "Importance du frein financier (0 = peu sensible, 10 = très sensible)",
  externalInfluence:
    "Rôle décisionnel de l'entourage (0 = autonome, 10 = entourage déterminant)",
  decisionStage:
    "Avancement dans le parcours (0 = exploration, 10 = prêt à signer)",
};

export type PsyRadar = Record<PsyAxis, number | null>;

export type PsySnapshot = {
  id: string;
  sessionId: string;
  patientId: string;
  radar: PsyRadar;
  tags: string[];
  rawOutput: unknown;
  promptVersion: string;
  model: string;
  createdAt: Date;
};

