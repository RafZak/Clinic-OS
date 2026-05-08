import type { PsyRadar } from "./axes";

/**
 * Tags marketing dérivés des seuils sur les 6 axes psychologiques.
 * Un patient peut avoir plusieurs tags simultanément.
 * Si un axe est null, toute règle qui en dépend est ignorée.
 * Cf. spec §6.2.
 */

export const PSY_TAGS = [
  "prospect-chaud",
  "prospect-froid",
  "réfractaire-prix",
  "en-déni",
  "entourage-décisif",
  "méfiant",
  "décisionnaire-éclairé",
  "à-rassurer",
  "à-éduquer",
  "prêt-conversion",
] as const;

export type PsyTag = (typeof PSY_TAGS)[number];

export const PSY_TAG_LABEL: Record<PsyTag, string> = {
  "prospect-chaud": "Prospect chaud",
  "prospect-froid": "Prospect froid",
  "réfractaire-prix": "Réfractaire prix",
  "en-déni": "En déni",
  "entourage-décisif": "Entourage décisif",
  méfiant: "Méfiant",
  "décisionnaire-éclairé": "Décisionnaire éclairé",
  "à-rassurer": "À rassurer",
  "à-éduquer": "À éduquer",
  "prêt-conversion": "Prêt conversion",
};

type Rule = {
  tag: PsyTag;
  test: (r: PsyRadar) => boolean;
};

const all = (...vals: (number | null | undefined)[]) =>
  vals.every((v) => v !== null && v !== undefined);

/**
 * L'ordre des règles définit la priorité d'affichage UI quand on
 * doit afficher un sous-ensemble (les premiers sont les plus saillants).
 */
export const PSY_TAG_RULES: ReadonlyArray<Rule> = [
  {
    tag: "prospect-chaud",
    test: (r) =>
      all(r.decisionStage, r.motivation) &&
      r.decisionStage! >= 7 &&
      r.motivation! >= 7,
  },
  {
    tag: "prêt-conversion",
    test: (r) =>
      all(r.decisionStage, r.priceSensitivity) &&
      r.decisionStage! >= 8 &&
      r.priceSensitivity! <= 5,
  },
  {
    tag: "réfractaire-prix",
    test: (r) =>
      all(r.priceSensitivity, r.decisionStage) &&
      r.priceSensitivity! >= 7 &&
      r.decisionStage! <= 5,
  },
  {
    tag: "à-rassurer",
    test: (r) =>
      all(r.trust, r.motivation) && r.trust! <= 4 && r.motivation! >= 5,
  },
  {
    tag: "méfiant",
    test: (r) => r.trust !== null && r.trust !== undefined && r.trust <= 3,
  },
  {
    tag: "en-déni",
    test: (r) =>
      r.acceptance !== null && r.acceptance !== undefined && r.acceptance <= 3,
  },
  {
    tag: "entourage-décisif",
    test: (r) =>
      r.externalInfluence !== null &&
      r.externalInfluence !== undefined &&
      r.externalInfluence >= 7,
  },
  {
    tag: "décisionnaire-éclairé",
    test: (r) =>
      all(r.decisionStage, r.acceptance, r.motivation) &&
      r.decisionStage! >= 6 &&
      r.acceptance! >= 6 &&
      r.motivation! >= 6,
  },
  {
    tag: "à-éduquer",
    test: (r) =>
      all(r.acceptance, r.decisionStage) &&
      r.acceptance! <= 5 &&
      r.decisionStage! <= 4,
  },
  {
    tag: "prospect-froid",
    test: (r) =>
      all(r.decisionStage, r.motivation) &&
      r.decisionStage! <= 3 &&
      r.motivation! <= 4,
  },
];

export function computeTags(radar: PsyRadar): PsyTag[] {
  return PSY_TAG_RULES.filter((rule) => rule.test(radar)).map((r) => r.tag);
}
