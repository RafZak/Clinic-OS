/**
 * Scénarios replay d'appels entrants — framework v3 validé Jonathan 25/04/2026.
 *
 * Convention : speaker="practitioner" représente l'assistante d'accueil
 * (Sophie Bernard, role='assistant'), speaker="patient" représente l'appelant.
 * Cette dualité reste cohérente avec les transcripts consultation et avec
 * le check constraint transcript_lines.speaker_check.
 */
import {
  computeTimedLines,
  estimateDurationSeconds,
  type ReplayTurn,
} from "./scripts";

export type ReplayPhoneCallType =
  | "new_patient"
  | "renewal"
  | "trial_followup"
  | "tech_issue"
  | "info_request"
  | "urgency"
  | "admin";

export type ReplayPhoneScenario = {
  slug: string;
  label: string;
  callerLabel: string;
  callerAge: number;
  callerStatus: "prospect" | "patient" | "lost";
  targetScore: number;
  targetDurationSeconds: number;
  expectedCallType: ReplayPhoneCallType;
  expectedOutcome: "rdv_pris" | "rdv_perdu";
  summary: string;
  turns: ReplayTurn[];
};

// ============================================================
// Scenario A — Mme Caroline Dubois — appel converti (target 82)
// ============================================================
//
// Patiente 67 ans, premier contact, orientée par son médecin traitant.
// Sophie Bernard (assistante Lyon 3) gère correctement : capture
// l'identité tôt, trie comme nouveau patient, pose 1 question de
// découverte (mais une seule → axe d'amélioration), propose 2 créneaux
// pour un bilan 60 min, demande l'email pour SMS, mentionne l'ordonnance
// ORL en clôture (pas en début).
// ============================================================

const DUBOIS_TURNS: ReplayTurn[] = [
  {
    speaker: "practitioner",
    text: "Audition Lyon 3, Sophie à votre écoute. Bonjour, que puis-je faire pour vous ?",
    pauseMsBefore: 200,
  },
  {
    speaker: "patient",
    text: "Bonjour Madame. Voilà, mon médecin traitant m'a parlé d'audition la semaine dernière, il m'a dit qu'il serait bien que je fasse un bilan. Je voulais voir avec vous comment ça se passe.",
    pauseMsBefore: 600,
  },
  {
    speaker: "practitioner",
    text: "Très bien, je vais regarder ça avec vous. Pour bien vous orienter, est-ce que vous pouvez d'abord me donner votre prénom et votre nom s'il vous plaît ?",
    pauseMsBefore: 500,
  },
  {
    speaker: "patient",
    text: "Oui bien sûr, Caroline Dubois. D-U-B-O-I-S.",
  },
  {
    speaker: "practitioner",
    text: "Merci Madame Dubois. Et c'est la première fois que vous nous contactez, c'est bien ça ? Vous êtes pas suivie ailleurs ?",
    pauseMsBefore: 400,
  },
  {
    speaker: "patient",
    text: "Oui c'est la première fois. Je n'ai jamais eu d'appareil ni rien.",
  },
  {
    speaker: "practitioner",
    text: "D'accord, donc on va vous proposer un premier bilan auditif avec notre audioprothésiste, Monsieur Goldminc. Avant que je vous propose un créneau, dites-moi juste, c'est plutôt depuis quand que vous sentez que vous entendez moins bien ?",
    pauseMsBefore: 500,
  },
  {
    speaker: "patient",
    text: "Oh ça fait un peu plus d'un an je dirais. Surtout en réunion ou au restaurant avec mes enfants, je décroche, je fais répéter. C'est ça qui m'a poussée à en parler à mon médecin.",
    pauseMsBefore: 800,
  },
  {
    speaker: "practitioner",
    text: "Très bien, je note. Pour ce premier bilan, on va prendre une heure ensemble pour faire le point complet, vous écouter, et regarder ensemble ce qui peut vous aider. Je vous propose deux créneaux, j'ai jeudi prochain à 14h ou vendredi à 10h. Lequel vous arrange le mieux ?",
    pauseMsBefore: 400,
  },
  {
    speaker: "patient",
    text: "Vendredi 10h ce serait parfait, j'ai mon mari qui peut m'accompagner.",
    pauseMsBefore: 600,
  },
  {
    speaker: "practitioner",
    text: "Parfait, vendredi 10h c'est noté. Pour vous envoyer la confirmation, vous avez une adresse email où je peux vous écrire ?",
    pauseMsBefore: 400,
  },
  {
    speaker: "patient",
    text: "Oui, c'est caroline.dubois arobase gmail point com.",
  },
  {
    speaker: "practitioner",
    text: "Très bien, je vous envoie la confirmation par mail dans la foulée. Donc on se voit vendredi prochain à 10 heures, Madame Dubois. Ah, dernière chose : si votre médecin vous a fait une ordonnance pour un ORL ou pour le bilan, n'hésitez pas à l'amener, ce n'est pas obligatoire mais ça nous aide. Sinon, on s'occupe de tout sur place.",
    pauseMsBefore: 500,
  },
  {
    speaker: "patient",
    text: "Très bien, vendredi 10h, je note. Merci beaucoup Madame.",
    pauseMsBefore: 700,
  },
  {
    speaker: "practitioner",
    text: "Avec plaisir Madame Dubois, à vendredi, bonne journée à vous !",
    pauseMsBefore: 300,
  },
];

// ============================================================
// Scenario B — M. Robert Lefranc — appel perdu (target 38)
// ============================================================
//
// Patient 71 ans, premier contact via une pub, sceptique sur le prix.
// Sophie Bernard (ou collègue moins bien formée) rate l'appel : décroché
// tardif, pas de présentation centre, saute identification + triage,
// balance directement une fourchette de prix sans avoir compris le
// contexte, élude l'objection ("voyez avec votre mutuelle"), ne propose
// aucun RDV. Lefranc raccroche poliment. Lead 100% perdu : aucun nom,
// aucune coordonnée, aucune trace exploitable dans le CRM.
// ============================================================

const LEFRANC_TURNS: ReplayTurn[] = [
  {
    speaker: "practitioner",
    text: "Allô, oui ?",
    pauseMsBefore: 1500,
  },
  {
    speaker: "patient",
    text: "Bonjour, j'appelle pour des appareils auditifs, je voulais savoir combien ça coûte.",
    pauseMsBefore: 700,
  },
  {
    speaker: "practitioner",
    text: "Ah, des appareils auditifs. Alors ça dépend de plein de choses Monsieur, mais comptez quand même entre 1500 et 4000 euros la paire selon le modèle.",
    pauseMsBefore: 600,
  },
  {
    speaker: "patient",
    text: "Ah ouais quand même, c'est pas donné. Et c'est remboursé ça ou pas ?",
    pauseMsBefore: 700,
  },
  {
    speaker: "practitioner",
    text: "Oui enfin ça dépend de votre mutuelle. Faut voir avec votre mutuelle Monsieur, c'est eux qui pourront vous dire combien ils prennent en charge.",
    pauseMsBefore: 400,
  },
  {
    speaker: "patient",
    text: "Mmh. Et vous avez pas quelque chose de moins cher quand même ? 1500 euros minimum c'est beaucoup pour des oreilles.",
    pauseMsBefore: 800,
  },
  {
    speaker: "practitioner",
    text: "Ah non en dessous Monsieur c'est pas conseillé, c'est de la qualité moyenne. Faut compter ces tarifs-là pour avoir du bon matériel.",
    pauseMsBefore: 500,
  },
  {
    speaker: "patient",
    text: "Bon ben écoutez ça ne va pas être possible alors. Je vais réfléchir et je rappellerai peut-être plus tard.",
    pauseMsBefore: 1000,
  },
  {
    speaker: "practitioner",
    text: "D'accord Monsieur, comme vous voulez. Vous nous rappelez quand vous voulez.",
    pauseMsBefore: 500,
  },
  {
    speaker: "patient",
    text: "C'est ça. Bonne journée, au revoir.",
    pauseMsBefore: 400,
  },
  {
    speaker: "practitioner",
    text: "Au revoir Monsieur.",
    pauseMsBefore: 200,
  },
];

export const REPLAY_PHONE_SCENARIOS: ReplayPhoneScenario[] = [
  {
    slug: "dubois-converti",
    label: "Mme Dubois — appel converti (RDV pris)",
    callerLabel: "Mme Caroline Dubois",
    callerAge: 67,
    callerStatus: "prospect",
    targetScore: 82,
    expectedCallType: "new_patient",
    expectedOutcome: "rdv_pris",
    targetDurationSeconds: estimateDurationSeconds(DUBOIS_TURNS),
    summary:
      "Sophie capture l'identité tôt, trie comme nouveau patient, propose 2 créneaux pour un bilan 60 min et obtient l'email. Une seule question de découverte au lieu de 2 — axe d'amélioration mineur.",
    turns: DUBOIS_TURNS,
  },
  {
    slug: "lefranc-perdu",
    label: "M. Lefranc — appel perdu (objection prix éludée)",
    callerLabel: "M. Robert Lefranc",
    callerAge: 71,
    callerStatus: "lost",
    targetScore: 38,
    expectedCallType: "info_request",
    expectedOutcome: "rdv_perdu",
    targetDurationSeconds: estimateDurationSeconds(LEFRANC_TURNS),
    summary:
      "Pas de présentation centre, saute identification et triage, balance le prix sans contexte, élude l'objection, ne propose aucun RDV. Lead 100% perdu — aucune coordonnée capturée.",
    turns: LEFRANC_TURNS,
  },
];

export function getPhoneScenarioBySlug(
  slug: string
): ReplayPhoneScenario | undefined {
  return REPLAY_PHONE_SCENARIOS.find((s) => s.slug === slug);
}

export { computeTimedLines };
