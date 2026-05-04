import type { Locale } from "@/lib/locale";

export type FrameworkCriterion = {
  id: string;
  label: string;
  label_en: string;
};

export type FrameworkStep = {
  number: number;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  criteria: FrameworkCriterion[];
  /**
   * Étape observable dans la fenêtre de la conversation analysée.
   * Quand `false`, l'étape reste dans le référentiel métier (knowledge base,
   * formation) mais n'est ni notée, ni coachée, ni affichée dans les radars
   * et heatmaps : elle se déroule hors de l'audio capturé (avant ou après
   * la consultation), donc impossible à juger sur transcript.
   */
  scorable?: boolean;
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
    name_en: "Preparation",
    description: "Conditions d'accueil physiologiques et matérielles",
    description_en: "Physical and material welcome conditions",
    criteria: [
      { id: "prep_materiel", label: "Matériel prêt et fonctionnel", label_en: "Equipment ready and functional" },
      { id: "prep_ambiance", label: "Ambiance accueillante (lumière, son, propreté)", label_en: "Welcoming atmosphere (light, sound, cleanliness)" },
      { id: "prep_planning", label: "Planning respecté, pas de retard", label_en: "Schedule respected, no delay" },
    ],
    scorable: false,
  },
  {
    number: 2,
    name: "Introduction",
    name_en: "Introduction",
    description: "Accueillir, mettre à l'aise, se présenter, valider l'agenda",
    description_en: "Welcome, put at ease, introduce yourself, validate the agenda",
    criteria: [
      { id: "intro_presentation", label: "Se présente avec nom + fonction", label_en: "Introduces self with name + role" },
      { id: "intro_accueil_humain", label: "Marque une attention au confort du patient (propose un verre d'eau, vérifie qu'il a trouvé, prend des nouvelles)", label_en: "Shows attention to patient comfort (offers water, checks they found the place, asks how they are)" },
      { id: "intro_brise_glace", label: "Échange chaleureux court avant d'entrer dans le médical (sujet léger, mise à l'aise)", label_en: "Brief warm exchange before clinical content (light topic, putting at ease)" },
      { id: "intro_agenda", label: "Annonce le déroulé du rendez-vous", label_en: "Announces the appointment outline" },
      { id: "intro_duree", label: "Donne la durée estimée", label_en: "Gives the estimated duration" },
    ],
  },
  {
    number: 3,
    name: "Identification des besoins",
    name_en: "Needs identification",
    description: "Échanger pour identifier les besoins",
    description_en: "Conversation to identify needs",
    criteria: [
      { id: "besoins_ouvertes", label: "≥ 3 questions ouvertes posées", label_en: "≥ 3 open-ended questions asked" },
      { id: "besoins_vie_quotidienne", label: "Explore la vie quotidienne (travail, famille, loisirs)", label_en: "Explores daily life (work, family, leisure)" },
      { id: "besoins_motifs", label: "Identifie le déclencheur de la visite", label_en: "Identifies the trigger for the visit" },
      { id: "besoins_reformulation", label: "Reformule ce qu'il a compris", label_en: "Reformulates what was understood" },
    ],
  },
  {
    number: 4,
    name: "Présentation",
    name_en: "Presentation",
    description: "Présenter les options en vulgarisant",
    description_en: "Present options in plain language",
    criteria: [
      { id: "present_vulgarisation", label: "Vulgarise le jargon technique", label_en: "Plain-language explanations of technical jargon" },
      { id: "present_options", label: "Présente plusieurs options (pas juste une)", label_en: "Presents several options (not just one)" },
      { id: "present_supports", label: "Utilise supports visuels (maquette, catalogue)", label_en: "Uses visual aids (model, catalogue)" },
    ],
  },
  {
    number: 5,
    name: "Bilan et démonstration",
    name_en: "Assessment and demo",
    description: "Adapter les tests, donner un avant-goût",
    description_en: "Tailor the tests, give a preview",
    criteria: [
      { id: "bilan_tests", label: "Explique chaque test avant de le faire", label_en: "Explains each test before performing it" },
      { id: "bilan_resultats", label: "Partage les résultats avec le patient", label_en: "Shares results with the patient" },
      { id: "bilan_demonstration", label: "Fait essayer une paire d'aides auditives", label_en: "Lets the patient try a pair of hearing aids" },
    ],
  },
  {
    number: 6,
    name: "Recommandation",
    name_en: "Recommendation",
    description: "Dévoiler la solution adaptée",
    description_en: "Reveal the suitable solution",
    criteria: [
      { id: "reco_justifiee", label: "Justifie la recommandation par les besoins identifiés", label_en: "Justifies the recommendation against identified needs" },
      { id: "reco_prix", label: "Annonce le prix clairement", label_en: "States the price clearly" },
      { id: "reco_reste_a_charge", label: "Précise le reste à charge classe 1 vs classe 2", label_en: "Clarifies out-of-pocket cost tier 1 vs tier 2" },
    ],
  },
  {
    number: 7,
    name: "Objections",
    name_en: "Objections",
    description: "Accueillir comme un signe d'intérêt",
    description_en: "Welcome objections as a sign of interest",
    criteria: [
      { id: "obj_accueil", label: "Accueille sans couper (pas de \"mais…\" immédiat)", label_en: "Welcomes without cutting in (no immediate \"but…\")" },
      { id: "obj_creuser", label: "Creuse l'objection avant d'argumenter", label_en: "Digs into the objection before responding" },
      { id: "obj_reformule", label: "Reformule l'objection", label_en: "Reformulates the objection" },
      { id: "obj_argumente", label: "Argumente par la valeur ou la preuve sociale", label_en: "Counters with value or social proof" },
    ],
  },
  {
    number: 8,
    name: "Conclusion",
    name_en: "Conclusion",
    description: "Résumer les engagements pris, fixer la suite, sécuriser la relation",
    description_en: "Summarize commitments, lock in next steps, secure the relationship",
    criteria: [
      { id: "conclu_synthese", label: "Fait une synthèse orale de la décision", label_en: "Makes an oral synthesis of the decision" },
      { id: "conclu_rdv_essai", label: "Fixe le RDV d'essai ou de livraison avant le départ du patient", label_en: "Books the trial or delivery appointment before the patient leaves" },
      { id: "conclu_validation", label: "Obtient une validation explicite du patient", label_en: "Obtains an explicit confirmation from the patient" },
      { id: "conclu_rappel", label: "Annonce un rappel pour vérifier le bon déroulement de l'essai", label_en: "Announces a follow-up call to check the trial is going well" },
      { id: "conclu_coordonnees", label: "Donne ses coordonnées directes en cas de question", label_en: "Provides direct contact info for questions" },
    ],
  },
  {
    number: 9,
    name: "Décontraction",
    name_en: "Decompression",
    description: "Note humaine en fin de rendez-vous",
    description_en: "Human moment at the end of the visit",
    criteria: [
      { id: "deco_sujet_perso", label: "Aborde un sujet personnel (famille, loisirs)", label_en: "Brings up a personal topic (family, hobbies)" },
      { id: "deco_humour", label: "Moment de légèreté / humour adapté", label_en: "Light moment / appropriate humor" },
    ],
  },
  {
    number: 10,
    name: "Suivi",
    name_en: "Follow-up",
    description: "Entretenir la relation entre les rendez-vous (hors fenêtre de la consultation)",
    description_en: "Maintain the relationship between appointments (outside the consultation window)",
    criteria: [
      { id: "suivi_rappel_j2", label: "Rappel SMS ou email à J-2 du prochain rendez-vous", label_en: "SMS or email reminder 2 days before the next appointment" },
      { id: "suivi_relance_essai", label: "Prise de nouvelles pendant la période d'essai (téléphone ou message)", label_en: "Follow-up during the trial period (phone or message)" },
      { id: "suivi_relance_silencieux", label: "Relance des patients silencieux après un rendez-vous (pas de retour spontané)", label_en: "Outreach to silent patients after an appointment (no spontaneous reply)" },
    ],
    scorable: false,
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
 */
export const PHONE_CALL_FRAMEWORK: FrameworkStep[] = [
  {
    number: 1,
    name: "Accueil",
    name_en: "Greeting",
    description: "15 premières secondes — neutre, professionnel, ouvert",
    description_en: "First 15 seconds — neutral, professional, open",
    criteria: [
      { id: "acc_rapidite", label: "Décroché ≤ 4 sonneries", label_en: "Picked up within 4 rings" },
      { id: "acc_presentation", label: "Nom du centre + prénom annoncés", label_en: "Center name + first name announced" },
      { id: "acc_ouverture_ouverte", label: "Question d'ouverture ouverte (\"Que puis-je faire pour vous ?\")", label_en: "Open opening question (\"How may I help you?\")" },
      { id: "acc_ton", label: "Ton positif / sourire audible", label_en: "Positive tone / audible smile" },
    ],
  },
  {
    number: 2,
    name: "Identification",
    name_en: "Identification",
    description: "Capturer l'identité avant d'aller plus loin — pour pouvoir relancer même si l'appel n'aboutit pas",
    description_en: "Capture identity early — so we can follow up even if the call doesn't close",
    criteria: [
      { id: "id_prenom_nom", label: "Prénom + nom demandés tôt dans l'appel", label_en: "First name + last name asked early in the call" },
      { id: "id_email", label: "Email demandé (idéal pour SMS/relances)", label_en: "Email asked (ideal for SMS/follow-up)" },
      { id: "id_telephone", label: "Téléphone de rappel capturé (obligatoire si pas d'email)", label_en: "Callback number captured (required if no email)" },
      { id: "id_pas_anonyme", label: "Au moins une coordonnée capturée — pas d'appel anonyme", label_en: "At least one contact captured — no anonymous call" },
    ],
  },
  {
    number: 3,
    name: "Triage",
    name_en: "Triage",
    description: "Comprendre la raison de l'appel pour router vers la bonne prise en charge",
    description_en: "Understand the call's purpose to route to the right care path",
    criteria: [
      { id: "tri_categorisation", label: "Catégorisation explicite (nouveau patient / problème technique / renouvellement / suivi / admin / urgence)", label_en: "Explicit categorisation (new patient / tech issue / renewal / follow-up / admin / urgency)" },
      { id: "tri_clarification", label: "Question de clarification posée si la raison est floue", label_en: "Clarification question asked if the reason is unclear" },
      { id: "tri_pas_de_precipitation", label: "Pas de précipitation vers une solution avant d'avoir compris", label_en: "No rush to a solution before understanding" },
    ],
  },
  {
    number: 4,
    name: "Découverte ciblée",
    name_en: "Targeted discovery",
    description: "Quelques questions génériques selon la raison identifiée — utiles pour briefer le pro",
    description_en: "A few generic questions based on the identified reason — useful to brief the audiologist",
    criteria: [
      { id: "dec_questions_ouvertes", label: "≥ 2 questions ouvertes adaptées au type d'appel", label_en: "≥ 2 open-ended questions tailored to the call type" },
      { id: "dec_motivation", label: "Motivation / démotivation comprise (depuis quand, contexte de gêne, attentes)", label_en: "Motivation / demotivation understood (since when, context, expectations)" },
      { id: "dec_pas_de_gamme", label: "Reste générique : pas de gamme, pas de prix, pas de classe 1/2, pas de forme d'appareil", label_en: "Stays generic: no product range, no price, no tier 1/2, no device form" },
      { id: "dec_notes_pro", label: "Notes capturées utiles pour briefer l'audioprothésiste", label_en: "Notes captured to brief the audiologist" },
    ],
  },
  {
    number: 5,
    name: "Action adaptée",
    name_en: "Tailored action",
    description: "Proposer le bon type de prise en charge selon le triage",
    description_en: "Offer the right type of care based on triage",
    criteria: [
      { id: "act_bonne_duree", label: "RDV de la bonne durée selon le motif (bilan 60 min / technique 15 min / renouvellement 45 min)", label_en: "Appointment of the right duration (full review 60 min / tech 15 min / renewal 45 min)" },
      { id: "act_2_creneaux", label: "2 créneaux proposés (jamais 1, jamais \"quand vous voulez\")", label_en: "2 slots proposed (never 1, never \"whenever\")" },
      { id: "act_benefice", label: "Bénéfice patient explicité (pas juste logistique)", label_en: "Patient benefit made explicit (not just logistics)" },
      { id: "act_resolution_telephone", label: "Si problème technique simple : tentative de résolution téléphone avant de proposer un RDV", label_en: "If simple tech issue: try phone resolution before offering an appointment" },
    ],
  },
  {
    number: 6,
    name: "Ancrage et clôture",
    name_en: "Anchoring and close",
    description: "Verrouiller le RDV — calibré population senior",
    description_en: "Lock down the appointment — calibrated for senior callers",
    criteria: [
      { id: "ancr_repetition", label: "Date/heure répétées 2 fois", label_en: "Date/time repeated twice" },
      { id: "ancr_sms", label: "Engagement sur SMS/email de confirmation", label_en: "Commitment to send SMS/email confirmation" },
      { id: "ancr_documents", label: "Documents à apporter rappelés (carte vitale, mutuelle, audiogramme antérieur si existant)", label_en: "Documents to bring mentioned (health card, insurance, prior audiogram if any)" },
      { id: "ancr_cloture", label: "Clôture chaleureuse non-transactionnelle", label_en: "Warm, non-transactional close" },
    ],
  },
];

export function getFramework(kind: FrameworkKind): FrameworkStep[] {
  return kind === "consultation" ? CONSULTATION_FRAMEWORK : PHONE_CALL_FRAMEWORK;
}

/**
 * Étapes effectivement observables dans la conversation analysée.
 * Référence pour scoring, coaching, radars et heatmaps. Les étapes hors
 * fenêtre (préparation matérielle, suivi post-RDV) restent dans
 * `getFramework` pour la knowledge base et la formation.
 */
export function getScorableFramework(kind: FrameworkKind): FrameworkStep[] {
  return getFramework(kind).filter((s) => s.scorable !== false);
}

export function isStepScorable(kind: FrameworkKind, stepNumber: number): boolean {
  const step = getFramework(kind).find((s) => s.number === stepNumber);
  return step ? step.scorable !== false : false;
}

export function getStepName(step: FrameworkStep, locale: Locale): string {
  return locale === "en" ? step.name_en : step.name;
}

export function getStepDescription(step: FrameworkStep, locale: Locale): string {
  return locale === "en" ? step.description_en : step.description;
}

export function getCriterionLabel(c: FrameworkCriterion, locale: Locale): string {
  return locale === "en" ? c.label_en : c.label;
}

export function getFrameworkLocalized(
  kind: FrameworkKind,
  locale: Locale
): { number: number; name: string; description: string; criteria: { id: string; label: string }[] }[] {
  return getFramework(kind).map((step) => ({
    number: step.number,
    name: getStepName(step, locale),
    description: getStepDescription(step, locale),
    criteria: step.criteria.map((c) => ({ id: c.id, label: getCriterionLabel(c, locale) })),
  }));
}

export const FRAMEWORK_LABEL: Record<FrameworkKind, string> = {
  consultation: "Consultation",
  phone_call: "Appel entrant",
};
