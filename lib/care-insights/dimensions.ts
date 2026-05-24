import type { PsyRadar } from "@/lib/psychology/axes";

/**
 * Vue "soin" de la page patient. Mapping d'affichage uniquement depuis le
 * radar psychologie existant — aucune donnée commerciale n'est exposée
 * (priceSensitivity est volontairement omis). Ne modifie pas le backend.
 */
export const CARE_DIMENSIONS = [
  "acceptance",
  "trust",
  "entourage",
  "careAlignment",
  "careEngagement",
] as const;
export type CareDimension = (typeof CARE_DIMENSIONS)[number];

/** Score 0-10 par dimension soin, dérivé du radar psychologie. null si non observé. */
export function mapRadarToCare(radar: PsyRadar): Record<CareDimension, number | null> {
  return {
    acceptance: radar.acceptance,
    trust: radar.trust,
    entourage: radar.externalInfluence,
    careAlignment: radar.decisionStage,
    careEngagement: radar.motivation,
  };
}

export const CARE_LABEL_FR: Record<CareDimension, string> = {
  acceptance: "Acceptation",
  trust: "Confiance",
  entourage: "Entourage",
  careAlignment: "Adéquation du soin",
  careEngagement: "Engagement dans le soin",
};
export const CARE_LABEL_EN: Record<CareDimension, string> = {
  acceptance: "Acceptance",
  trust: "Trust",
  entourage: "Entourage",
  careAlignment: "Care Alignment",
  careEngagement: "Care engagement",
};

export const CARE_SUB_FR: Record<CareDimension, string> = {
  acceptance: "Cheminement vers l'acceptation de la perte auditive",
  trust: "Confiance construite avec le clinicien au fil des visites",
  entourage: "Rôle des proches dans la décision",
  careAlignment: "Adéquation entre le plan de soin proposé et le patient",
  careEngagement: "Implication du patient dans son parcours de soin",
};
export const CARE_SUB_EN: Record<CareDimension, string> = {
  acceptance: "Coming to terms with hearing loss",
  trust: "Confidence built with the clinician over visits",
  entourage: "How family or close ones shape the decision",
  careAlignment: "How aligned the care plan is with the patient",
  careEngagement: "Involvement in their own care journey",
};

export const CARE_CAPTURES_FR: Record<CareDimension, string> = {
  acceptance:
    "Déni, ambivalence ou acceptation — lu dans la façon dont le patient parle de ses difficultés.",
  trust: "Le patient se sent-il en sécurité, écouté, libre d'exprimer ses doutes.",
  entourage:
    "Qui compte, qui accompagne, qui pèse dans la décision — repris des mentions de l'entourage.",
  careAlignment:
    "Le soin proposé correspond-il à ce dont le patient a besoin et se sent prêt à entreprendre.",
  careEngagement:
    "Présence, suivi des recommandations, essais réalisés, questions sur sa santé auditive.",
};
export const CARE_CAPTURES_EN: Record<CareDimension, string> = {
  acceptance:
    "Denial, ambivalence or acceptance — read from how the patient talks about their difficulties.",
  trust: "Whether the patient feels safe, heard, and able to voice doubts.",
  entourage:
    "Who else matters, who accompanies, who weighs in — read from mentions of the entourage.",
  careAlignment:
    "Whether the proposed care fits what the patient needs and feels ready for.",
  careEngagement:
    "Attendance, follow-through, trials done, questions about their hearing health.",
};

export const CARE_USED_FR: Record<CareDimension, string> = {
  acceptance: "Rencontrer le patient là où il en est dans son cheminement.",
  trust:
    "Savoir si la relation est assez solide pour aborder des sujets plus difficiles.",
  entourage:
    "Impliquer les bonnes personnes au bon moment — l'audition est une affaire de famille.",
  careAlignment:
    "Aider le patient à se sentir confiant et soutenu dans le soin qui lui convient.",
  careEngagement:
    "Repérer un patient qui s'éloigne pour le ré-engager. Jamais l'intention d'achat.",
};
export const CARE_USED_EN: Record<CareDimension, string> = {
  acceptance: "Meet the patient where they are in their journey.",
  trust: "Tells whether the relationship is solid enough to broach harder topics.",
  entourage:
    "Bring the right people in at the right moment — hearing is a family matter.",
  careAlignment:
    "Help the patient feel confident and supported in the care that suits them.",
  careEngagement:
    "Spot a patient drifting away, to re-engage them. Never purchase intent.",
};
