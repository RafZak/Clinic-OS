import type { PsyTag } from "./tags";

/**
 * Suggestion d'action pour le pro quand un patient a ce tag.
 * Utilisé dans la section "Patients à recontacter" du dashboard.
 */
export const PSY_TAG_ACTIONS: Record<
  PsyTag,
  { fr: string; en: string; priority: number }
> = {
  "prêt-conversion": {
    fr: "Demander la signature, push offre",
    en: "Push offer, ask for signature",
    priority: 100,
  },
  "prospect-chaud": {
    fr: "Proposer rendez-vous d'essai cette semaine",
    en: "Schedule trial appointment this week",
    priority: 90,
  },
  "réfractaire-prix": {
    fr: "Proposer simulation financement / mutuelle",
    en: "Offer financing / insurance simulation",
    priority: 80,
  },
  "à-rassurer": {
    fr: "Audit second avis offert, contact référent",
    en: "Offer second-opinion audit, dedicated contact",
    priority: 70,
  },
  "entourage-décisif": {
    fr: "Proposer 2e RDV avec accompagnant",
    en: "Schedule second appointment with companion",
    priority: 60,
  },
  "décisionnaire-éclairé": {
    fr: "Comparatif technique, démo premium",
    en: "Technical comparison, premium demo",
    priority: 50,
  },
  "à-éduquer": {
    fr: "Inviter à un atelier découverte / webinaire",
    en: "Invite to discovery workshop / webinar",
    priority: 40,
  },
  méfiant: {
    fr: "Transparence renforcée, témoignages",
    en: "Enhanced transparency, testimonials",
    priority: 30,
  },
  "en-déni": {
    fr: "Témoignages patients, désamorcer le déni",
    en: "Patient testimonials, defuse denial",
    priority: 20,
  },
  "prospect-froid": {
    fr: "Nurturing long terme, contenu pédagogique",
    en: "Long-term nurturing, educational content",
    priority: 10,
  },
};

/**
 * Tags considérés comme "actionnables" pour la section dashboard
 * "Patients à recontacter" — on n'y fait remonter que ces 4 tags.
 */
export const ACTIONABLE_TAGS: ReadonlyArray<PsyTag> = [
  "prêt-conversion",
  "prospect-chaud",
  "réfractaire-prix",
  "à-rassurer",
];
