import type { CommunicationStyleKey, SetbackKey, PriorityKey } from "./types";

export const COMMUNICATION_KEYS: CommunicationStyleKey[] = [
  "reassurance-led",
  "evidence-led",
  "story-led",
  "visual-led",
  "peer-led",
];

export const SETBACK_KEYS: SetbackKey[] = [
  "cost-concern",
  "fear-of-stigma",
  "doubts-it-helps",
  "past-bad-experience",
  "not-ready-to-accept",
  "comfort-worries",
  "waiting-for-family",
  "overwhelmed-by-options",
];

export const PRIORITY_KEYS: PriorityKey[] = [
  "sound-quality",
  "social-life",
  "discretion",
  "budget-value",
  "comfort",
  "ease-of-use",
  "phone-calls",
  "tv-connectivity",
  "battery-life",
  "active-sport",
  "tinnitus-relief",
  "follow-up-service",
];

const COMMUNICATION_LABEL_FR: Record<CommunicationStyleKey, string> = {
  "reassurance-led": "Besoin d'être rassuré",
  "evidence-led": "Sensible aux preuves",
  "story-led": "Sensible au vécu",
  "visual-led": "Démonstration visuelle",
  "peer-led": "Avis de pairs",
};
const COMMUNICATION_LABEL_EN: Record<CommunicationStyleKey, string> = {
  "reassurance-led": "Reassurance-led",
  "evidence-led": "Evidence-led",
  "story-led": "Story-led",
  "visual-led": "Visual / demo-led",
  "peer-led": "Peer-led",
};

const SETBACK_LABEL_FR: Record<SetbackKey, string> = {
  "cost-concern": "Frein budgétaire",
  "fear-of-stigma": "Peur du regard",
  "doubts-it-helps": "Doute sur l'efficacité",
  "past-bad-experience": "Mauvaise expérience passée",
  "not-ready-to-accept": "Pas prêt à accepter",
  "comfort-worries": "Crainte sur le confort",
  "waiting-for-family": "Attend l'avis des proches",
  "overwhelmed-by-options": "Submergé par les options",
};
const SETBACK_LABEL_EN: Record<SetbackKey, string> = {
  "cost-concern": "Cost concern",
  "fear-of-stigma": "Fear of stigma",
  "doubts-it-helps": "Doubts it will help",
  "past-bad-experience": "Past bad experience",
  "not-ready-to-accept": "Not ready to accept",
  "comfort-worries": "Comfort worries",
  "waiting-for-family": "Waiting for family input",
  "overwhelmed-by-options": "Overwhelmed by options",
};

const PRIORITY_LABEL_FR: Record<PriorityKey, string> = {
  "sound-quality": "Qualité sonore",
  "social-life": "Vie sociale",
  discretion: "Discrétion",
  "budget-value": "Budget / valeur",
  comfort: "Confort",
  "ease-of-use": "Simplicité d'usage",
  "phone-calls": "Téléphone & appels",
  "tv-connectivity": "TV & connectivité",
  "battery-life": "Autonomie",
  "active-sport": "Activité / sport",
  "tinnitus-relief": "Soulagement acouphènes",
  "follow-up-service": "Suivi & service",
};
const PRIORITY_LABEL_EN: Record<PriorityKey, string> = {
  "sound-quality": "Sound quality",
  "social-life": "Social life",
  discretion: "Discretion",
  "budget-value": "Budget / value",
  comfort: "Comfort",
  "ease-of-use": "Ease of use",
  "phone-calls": "Phone & calls",
  "tv-connectivity": "TV & connectivity",
  "battery-life": "Battery life",
  "active-sport": "Active / sport",
  "tinnitus-relief": "Tinnitus relief",
  "follow-up-service": "Follow-up & service",
};

export function communicationLabel(
  k: CommunicationStyleKey,
  locale: "fr" | "en"
): string {
  return (locale === "en" ? COMMUNICATION_LABEL_EN : COMMUNICATION_LABEL_FR)[k];
}
export function setbackLabel(k: SetbackKey, locale: "fr" | "en"): string {
  return (locale === "en" ? SETBACK_LABEL_EN : SETBACK_LABEL_FR)[k];
}
export function priorityLabel(k: PriorityKey, locale: "fr" | "en"): string {
  return (locale === "en" ? PRIORITY_LABEL_EN : PRIORITY_LABEL_FR)[k];
}
