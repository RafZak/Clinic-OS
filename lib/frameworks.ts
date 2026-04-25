export type FrameworkCriterion = {
  id: string;
  label: string;
};

export type FrameworkStep = {
  number: number;
  name: string;
  description: string;
  criteria: FrameworkCriterion[];
};

export type FrameworkKind = "consultation" | "phone_call";

/**
 * Framework d'analyse d'une consultation audioprothèse — 10 étapes.
 * Source : module 8 d'Audio Vente conçu par Jonathan. Validé métier.
 * Ordre stable : c'est le référentiel scorable par étape dans session_scores.step_number.
 */
export const CONSULTATION_FRAMEWORK: FrameworkStep[] = [
  {
    number: 1,
    name: "Préparation",
    description: "Conditions d'accueil physiologiques et matérielles",
    criteria: [
      { id: "prep_materiel", label: "Matériel prêt et fonctionnel" },
      { id: "prep_ambiance", label: "Ambiance accueillante (lumière, son, propreté)" },
      { id: "prep_planning", label: "Planning respecté, pas de retard" },
    ],
  },
  {
    number: 2,
    name: "Introduction",
    description: "Se présenter, valider l'agenda",
    criteria: [
      { id: "intro_presentation", label: "Se présente avec nom + fonction" },
      { id: "intro_agenda", label: "Annonce le déroulé du rendez-vous" },
      { id: "intro_duree", label: "Donne la durée estimée" },
    ],
  },
  {
    number: 3,
    name: "Identification des besoins",
    description: "Échanger pour identifier les besoins",
    criteria: [
      { id: "besoins_ouvertes", label: "≥ 3 questions ouvertes posées" },
      { id: "besoins_vie_quotidienne", label: "Explore la vie quotidienne (travail, famille, loisirs)" },
      { id: "besoins_motifs", label: "Identifie le déclencheur de la visite" },
      { id: "besoins_reformulation", label: "Reformule ce qu'il a compris" },
    ],
  },
  {
    number: 4,
    name: "Présentation",
    description: "Présenter les options en vulgarisant",
    criteria: [
      { id: "present_vulgarisation", label: "Vulgarise le jargon technique" },
      { id: "present_options", label: "Présente plusieurs options (pas juste une)" },
      { id: "present_supports", label: "Utilise supports visuels (maquette, catalogue)" },
    ],
  },
  {
    number: 5,
    name: "Bilan et démonstration",
    description: "Adapter les tests, donner un avant-goût",
    criteria: [
      { id: "bilan_tests", label: "Explique chaque test avant de le faire" },
      { id: "bilan_resultats", label: "Partage les résultats avec le patient" },
      { id: "bilan_demonstration", label: "Fait essayer une paire d'aides auditives" },
    ],
  },
  {
    number: 6,
    name: "Recommandation",
    description: "Dévoiler la solution adaptée",
    criteria: [
      { id: "reco_justifiee", label: "Justifie la recommandation par les besoins identifiés" },
      { id: "reco_prix", label: "Annonce le prix clairement" },
      { id: "reco_reste_a_charge", label: "Précise le reste à charge classe 1 vs classe 2" },
    ],
  },
  {
    number: 7,
    name: "Objections",
    description: "Accueillir comme un signe d'intérêt",
    criteria: [
      { id: "obj_accueil", label: "Accueille sans couper (pas de \"mais…\" immédiat)" },
      { id: "obj_creuser", label: "Creuse l'objection avant d'argumenter" },
      { id: "obj_reformule", label: "Reformule l'objection" },
      { id: "obj_argumente", label: "Argumente par la valeur ou la preuve sociale" },
    ],
  },
  {
    number: 8,
    name: "Conclusion",
    description: "Résumer les engagements pris",
    criteria: [
      { id: "conclu_synthese", label: "Fait une synthèse orale de la décision" },
      { id: "conclu_next_steps", label: "Donne les prochaines étapes (essai, livraison)" },
      { id: "conclu_validation", label: "Obtient une validation explicite du patient" },
    ],
  },
  {
    number: 9,
    name: "Décontraction",
    description: "Note humaine en fin de rendez-vous",
    criteria: [
      { id: "deco_sujet_perso", label: "Aborde un sujet personnel (famille, loisirs)" },
      { id: "deco_humour", label: "Moment de légèreté / humour adapté" },
    ],
  },
  {
    number: 10,
    name: "Suivi",
    description: "Sécuriser contre la concurrence",
    criteria: [
      { id: "suivi_rdv_essai", label: "Fixe le RDV d'essai ou de livraison avant le départ" },
      { id: "suivi_rappel", label: "Promet un rappel pour vérifier l'essai" },
      { id: "suivi_joignable", label: "Donne ses coordonnées directes en cas de question" },
    ],
  },
];

/**
 * Framework d'analyse d'un appel entrant — 6 étapes — v3.
 *
 * Validé par Jonathan le 25 avril 2026. Philosophie centrale : l'appel
 * entrant est un acte de **triage**, pas un mini-acte de vente. La
 * standardiste doit capturer l'identité, comprendre la raison de l'appel,
 * et router vers le BON type de RDV (durée adaptée). Aucune décision sur
 * les gammes / prix / 100% santé / forme d'appareil — c'est le job de
 * l'audioprothésiste en RDV.
 *
 * Changements vs v2 :
 * - "Identification" devient une étape autonome (capture identité avant tout)
 * - "Triage" devient une étape autonome (catégoriser pour router)
 * - "Reformulation" supprimée comme étape (intégrée dans Triage / Découverte)
 * - "100% santé" supprimé des critères (pas le bon canal, pas le bon moment)
 * - Question ORL/ordonnance déplacée à l'étape Ancrage (étape 6, en clôture)
 *   — la mentionner trop tôt est vécu comme agressif commercialement
 * - Étape 5 devient "Action adaptée" : la bonne durée de RDV plutôt que
 *   "RDV à tout prix"
 */
export const PHONE_CALL_FRAMEWORK: FrameworkStep[] = [
  {
    number: 1,
    name: "Accueil",
    description: "15 premières secondes — neutre, professionnel, ouvert",
    criteria: [
      { id: "acc_rapidite", label: "Décroché ≤ 4 sonneries" },
      { id: "acc_presentation", label: "Nom du centre + prénom annoncés" },
      { id: "acc_ouverture_ouverte", label: "Question d'ouverture ouverte (\"Que puis-je faire pour vous ?\")" },
      { id: "acc_ton", label: "Ton positif / sourire audible" },
    ],
  },
  {
    number: 2,
    name: "Identification",
    description: "Capturer l'identité avant d'aller plus loin — pour pouvoir relancer même si l'appel n'aboutit pas",
    criteria: [
      { id: "id_prenom_nom", label: "Prénom + nom demandés tôt dans l'appel" },
      { id: "id_email", label: "Email demandé (idéal pour SMS/relances)" },
      { id: "id_telephone", label: "Téléphone de rappel capturé (obligatoire si pas d'email)" },
      { id: "id_pas_anonyme", label: "Au moins une coordonnée capturée — pas d'appel anonyme" },
    ],
  },
  {
    number: 3,
    name: "Triage",
    description: "Comprendre la raison de l'appel pour router vers la bonne prise en charge",
    criteria: [
      { id: "tri_categorisation", label: "Catégorisation explicite (nouveau patient / problème technique / renouvellement / suivi / admin / urgence)" },
      { id: "tri_clarification", label: "Question de clarification posée si la raison est floue" },
      { id: "tri_pas_de_precipitation", label: "Pas de précipitation vers une solution avant d'avoir compris" },
    ],
  },
  {
    number: 4,
    name: "Découverte ciblée",
    description: "Quelques questions génériques selon la raison identifiée — utiles pour briefer le pro",
    criteria: [
      { id: "dec_questions_ouvertes", label: "≥ 2 questions ouvertes adaptées au type d'appel" },
      { id: "dec_motivation", label: "Motivation / démotivation comprise (depuis quand, contexte de gêne, attentes)" },
      { id: "dec_pas_de_gamme", label: "Reste générique : pas de gamme, pas de prix, pas de classe 1/2, pas de forme d'appareil" },
      { id: "dec_notes_pro", label: "Notes capturées utiles pour briefer l'audioprothésiste" },
    ],
  },
  {
    number: 5,
    name: "Action adaptée",
    description: "Proposer le bon type de prise en charge selon le triage",
    criteria: [
      { id: "act_bonne_duree", label: "RDV de la bonne durée selon le motif (bilan 60 min / technique 15 min / renouvellement 45 min)" },
      { id: "act_2_creneaux", label: "2 créneaux proposés (jamais 1, jamais \"quand vous voulez\")" },
      { id: "act_benefice", label: "Bénéfice patient explicité (pas juste logistique)" },
      { id: "act_resolution_telephone", label: "Si problème technique simple : tentative de résolution téléphone avant de proposer un RDV" },
    ],
  },
  {
    number: 6,
    name: "Ancrage et clôture",
    description: "Verrouiller le RDV — calibré population senior",
    criteria: [
      { id: "ancr_repetition", label: "Date/heure répétées 2 fois" },
      { id: "ancr_sms", label: "Engagement sur SMS/email de confirmation" },
      { id: "ancr_documents", label: "Documents à apporter rappelés — ordonnance ORL mentionnée ICI si pertinent (jamais en début d'appel)" },
      { id: "ancr_cloture", label: "Clôture chaleureuse non-transactionnelle" },
    ],
  },
];

export function getFramework(kind: FrameworkKind): FrameworkStep[] {
  return kind === "consultation" ? CONSULTATION_FRAMEWORK : PHONE_CALL_FRAMEWORK;
}

export const FRAMEWORK_LABEL: Record<FrameworkKind, string> = {
  consultation: "Consultation",
  phone_call: "Appel entrant",
};
