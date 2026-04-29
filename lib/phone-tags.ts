/**
 * Tags produits par l'analyzer Sonnet 4.6 pour les sessions kind='phone_call'.
 * Stockés dans sessions.metadata.tags (jsonb). Cf. spec validée par Jonathan
 * le 25/04/2026 : l'appel entrant est un acte de TRIAGE, et un appel mal
 * taggé est un appel perdu pour le CRM.
 */

export const PHONE_CALL_TYPES = [
  "new_patient",
  "renewal",
  "trial_followup",
  "tech_issue",
  "info_request",
  "urgency",
  "admin",
] as const;
export type PhoneCallType = (typeof PHONE_CALL_TYPES)[number];

export const RECOMMENDED_ACTIONS = [
  "rdv_bilan_60min",
  "rdv_renouvellement_45min",
  "rdv_technique_15min",
  "rdv_technique_30min",
  "rappel_pro",
  "resolved_phone",
  "transfer_orl",
  "transfer_admin",
] as const;
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

export const LEAD_TEMPERATURES = ["hot", "warm", "cold", "lost"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const DATA_CAPTURE_LEVELS = ["complete", "partial", "anonymous"] as const;
export type DataCaptureLevel = (typeof DATA_CAPTURE_LEVELS)[number];

export type PhoneCallTags = {
  call_type: PhoneCallType;
  recommended_action: RecommendedAction;
  lead_temperature: LeadTemperature;
  data_capture: DataCaptureLevel;
  data_capture_note: string | null;
};

export const PHONE_CALL_TYPE_LABEL: Record<PhoneCallType, string> = {
  new_patient: "Nouveau patient",
  renewal: "Renouvellement",
  trial_followup: "Suivi d'essai",
  tech_issue: "Problème technique",
  info_request: "Demande d'information",
  urgency: "Urgence",
  admin: "Administratif",
};

export const PHONE_CALL_TYPE_LABEL_EN: Record<PhoneCallType, string> = {
  new_patient: "New patient",
  renewal: "Renewal",
  trial_followup: "Trial follow-up",
  tech_issue: "Tech issue",
  info_request: "Information request",
  urgency: "Urgency",
  admin: "Administrative",
};

export const RECOMMENDED_ACTION_LABEL: Record<RecommendedAction, string> = {
  rdv_bilan_60min: "RDV bilan 60 min",
  rdv_renouvellement_45min: "RDV renouvellement 45 min",
  rdv_technique_15min: "RDV technique 15 min",
  rdv_technique_30min: "RDV technique 30 min",
  rappel_pro: "Rappel par l'audioprothésiste",
  resolved_phone: "Résolu au téléphone",
  transfer_orl: "Transfert ORL (urgence)",
  transfer_admin: "Transfert secrétariat",
};

export const RECOMMENDED_ACTION_LABEL_EN: Record<RecommendedAction, string> = {
  rdv_bilan_60min: "Full review (60 min)",
  rdv_renouvellement_45min: "Renewal (45 min)",
  rdv_technique_15min: "Tech (15 min)",
  rdv_technique_30min: "Tech (30 min)",
  rappel_pro: "Audiologist callback",
  resolved_phone: "Resolved on the phone",
  transfer_orl: "ENT transfer (urgent)",
  transfer_admin: "Admin transfer",
};

export const LEAD_TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  hot: "Chaud",
  warm: "Tiède",
  cold: "Froid",
  lost: "Glacé",
};

export const LEAD_TEMPERATURE_LABEL_EN: Record<LeadTemperature, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  lost: "Frozen",
};

export const DATA_CAPTURE_LABEL: Record<DataCaptureLevel, string> = {
  complete: "Identité complète",
  partial: "Identité partielle",
  anonymous: "Anonyme",
};

export const DATA_CAPTURE_LABEL_EN: Record<DataCaptureLevel, string> = {
  complete: "Complete identity",
  partial: "Partial identity",
  anonymous: "Anonymous",
};

export type SessionMetadata = {
  tags?: PhoneCallTags;
  // Place réservée pour de futurs champs (analytics, intégrations) sans
  // refonte du schema.
  [key: string]: unknown;
};

export function parsePhoneTags(raw: unknown): PhoneCallTags | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const callType = r.call_type as string;
  const action = r.recommended_action as string;
  const temp = r.lead_temperature as string;
  const capture = r.data_capture as string;
  if (
    !PHONE_CALL_TYPES.includes(callType as PhoneCallType) ||
    !RECOMMENDED_ACTIONS.includes(action as RecommendedAction) ||
    !LEAD_TEMPERATURES.includes(temp as LeadTemperature) ||
    !DATA_CAPTURE_LEVELS.includes(capture as DataCaptureLevel)
  ) {
    return null;
  }
  const note = r.data_capture_note;
  return {
    call_type: callType as PhoneCallType,
    recommended_action: action as RecommendedAction,
    lead_temperature: temp as LeadTemperature,
    data_capture: capture as DataCaptureLevel,
    data_capture_note: typeof note === "string" ? note.slice(0, 500) : null,
  };
}
