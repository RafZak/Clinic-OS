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
 * Framework d'analyse d'un appel entrant — 6 étapes — v2.
 *
 * Version **backed par recherche externe** (23 avril 2026), à valider avec
 * Jonathan pour la nuance finale mais solidement ancrée dans la littérature :
 *
 * - Walter Learning + Youschool (secrétariat médical français)
 * - Keona Health (US healthcare call flow)
 * - Phonak Practice Forward (front office training, motivational interviewing)
 * - Méthode CRAC (Creuser-Reformuler-Argumenter-Contrôler-Suivi)
 * - Hamilton CapTel Amplify The Impact (hearing healthcare specific)
 *
 * Différences vs v1 (brouillon 5 étapes avant recherche) :
 * - Reformulation promue en étape à part entière (consensus médical FR)
 * - Objection APRÈS Proposition RDV (dans la vraie vie, l'objection surgit
 *   quand on concrétise, pas avant)
 * - Détection ordonnance/ORL ajoutée dans Découverte (spécificité audio FR)
 * - Ancrage séparé de la clôture (spécificité senior : répéter 2×, SMS)
 */
export const PHONE_CALL_FRAMEWORK: FrameworkStep[] = [
  {
    number: 1,
    name: "Accueil",
    description: "15 premières secondes — ton, présentation, ouverture proactive",
    criteria: [
      { id: "acc_rapidite", label: "Décroché ≤ 3 sonneries" },
      { id: "acc_presentation", label: "Nom du centre + prénom/fonction annoncés" },
      { id: "acc_ouverture", label: "Formule d'ouverture proactive (pas juste \"allô\")" },
      { id: "acc_ton", label: "Ton positif / sourire audible" },
    ],
  },
  {
    number: 2,
    name: "Découverte",
    description: "Entretien motivationnel — comprendre le besoin réel",
    criteria: [
      { id: "dec_questions_ouvertes", label: "≥ 2 questions ouvertes (depuis quand, contexte, impact)" },
      { id: "dec_motif", label: "Motif identifié (RDV / prix / problème appareil / suivi)" },
      { id: "dec_ordonnance", label: "Question ORL/ordonnance posée" },
      { id: "dec_ecoute_active", label: "Marqueur verbal d'écoute active (reprise)" },
    ],
  },
  {
    number: 3,
    name: "Reformulation",
    description: "Validation explicite du besoin avant de proposer",
    criteria: [
      { id: "ref_phrase_pivot", label: "Phrase-pivot \"Si je comprends bien…\" ou équivalent" },
      { id: "ref_validation", label: "Demande validation explicite (\"C'est bien ça ?\")" },
      { id: "ref_empathie", label: "Marqueur d'empathie sur la gêne exprimée" },
    ],
  },
  {
    number: 4,
    name: "Proposition RDV",
    description: "Alternative fermée, pas question ouverte",
    criteria: [
      { id: "prop_2_creneaux", label: "2 créneaux proposés (jamais 1, jamais \"quand vous voulez\")" },
      { id: "prop_duree", label: "Durée du RDV annoncée (ex. \"bilan 45 min gratuit\")" },
      { id: "prop_benefice", label: "Bénéfice patient explicité (pas juste logistique)" },
    ],
  },
  {
    number: 5,
    name: "Traitement objection",
    description: "Méthode CRAC — accueillir, creuser, argumenter, contrôler",
    criteria: [
      { id: "obj_accueil", label: "Objection accueillie sans couper" },
      { id: "obj_creuser", label: "≥ 1 question pour creuser avant d'argumenter" },
      { id: "obj_valeur", label: "Argumente par valeur / reste à charge 0 classe 1 si prix" },
      { id: "obj_re_propose", label: "Re-propose un créneau après traitement (ne pas abandonner)" },
    ],
  },
  {
    number: 6,
    name: "Ancrage et clôture",
    description: "Calibré population senior — répétition, SMS, clôture chaleureuse",
    criteria: [
      { id: "ancr_repetition", label: "Date/heure répétées 2 fois" },
      { id: "ancr_sms", label: "Engagement sur SMS/email de confirmation" },
      { id: "ancr_documents", label: "Documents à apporter rappelés (ordonnance, carte vitale)" },
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
