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

