import type { CareAxis } from "./types";

export const CARE_LABEL_FR: Record<CareAxis, string> = {
  rapport: "Relation",
  pedagogy: "Pédagogie",
  structure: "Structure de consultation",
  guidance: "Clarté de l'accompagnement",
  followThrough: "Suivi",
  adaptability: "Adaptabilité",
};
export const CARE_LABEL_EN: Record<CareAxis, string> = {
  rapport: "Rapport",
  pedagogy: "Pedagogy",
  structure: "Consultation structure",
  guidance: "Guidance clarity",
  followThrough: "Follow-through",
  adaptability: "Adaptability",
};

/** Labels courts pour le radar (place limitée). */
export const CARE_SHORT_FR: Record<CareAxis, string> = {
  rapport: "Relation",
  pedagogy: "Pédagogie",
  structure: "Structure",
  guidance: "Accompagnement",
  followThrough: "Suivi",
  adaptability: "Adaptabilité",
};
export const CARE_SHORT_EN: Record<CareAxis, string> = {
  rapport: "Rapport",
  pedagogy: "Pedagogy",
  structure: "Structure",
  guidance: "Guidance",
  followThrough: "Follow-through",
  adaptability: "Adaptability",
};

export const CARE_SUB_FR: Record<CareAxis, string> = {
  rapport: "Confiance et chaleur — le patient se sent entendu.",
  pedagogy: "Explication claire — complexité rendue compréhensible.",
  structure: "Une visite complète et rigoureuse.",
  guidance: "Aide le patient à bien décider.",
  followThrough: "Continuité après la visite.",
  adaptability: "S'adapte à des styles de patients très différents.",
};
export const CARE_SUB_EN: Record<CareAxis, string> = {
  rapport: "Trust and warmth — patients feel heard",
  pedagogy: "Clear explanation — complexity made understandable",
  structure: "A complete, thorough visit",
  guidance: "Helps the patient decide well",
  followThrough: "Continuity after the visit",
  adaptability: "Flexes to very different patient styles",
};

export const CARE_CAPTURES_FR: Record<CareAxis, string> = {
  rapport:
    "Marqueurs relationnels : reformulation empathique, écoute active, reconnaissance des émotions.",
  pedagogy:
    "Comment le clinicien explique les options et vérifie que le patient a compris.",
  structure:
    "Présence des étapes clés : anamnèse, reformulation du besoin, explication des options, prochaines étapes.",
  guidance:
    "Avec quelle clarté le clinicien expose les choix et accompagne la décision.",
  followThrough:
    "Relances pertinentes, engagement post-visite — le patient ne se sent pas abandonné.",
  adaptability:
    "L'éventail de styles relationnels que le clinicien sait mobiliser.",
};
export const CARE_CAPTURES_EN: Record<CareAxis, string> = {
  rapport:
    "Relational markers: empathetic reformulation, active listening, acknowledgement of feelings.",
  pedagogy:
    "How the clinician explains options and checks the patient actually understood.",
  structure:
    "Presence of the key steps: case history, reformulating the need, explaining options, next steps.",
  guidance:
    "How clearly the clinician lays out the choices and accompanies the decision.",
  followThrough:
    "Relevant follow-ups, post-visit engagement — the patient doesn't feel abandoned.",
  adaptability: "The range of relational styles the clinician can mobilise.",
};

export const CARE_NOT_FR: Record<CareAxis, string> = {
  rapport: "Une force de développement — jamais une note de personnalité.",
  pedagogy: "Mesure la clarté du soin — pas la force de persuasion.",
  structure:
    "Complétude de l'acte de soin — jamais le rendement commercial par RDV.",
  guidance: "Aider le patient à décider — jamais conclure une vente.",
  followThrough: "Continuité du soin — pas une métrique de relance pour upsell.",
  adaptability:
    "Étendue des styles de soin — jamais la capacité à lever des objections.",
};
export const CARE_NOT_EN: Record<CareAxis, string> = {
  rapport: "A developmental strength — never a personality grade.",
  pedagogy: "Measures clarity of care — not persuasiveness.",
  structure:
    "Completeness of the care act — never commercial output per appointment.",
  guidance: "Helping the patient decide — never closing a sale.",
  followThrough: "Continuity of care — not a recall-to-upsell metric.",
  adaptability: "Breadth of care styles — never ability to overcome objections.",
};
