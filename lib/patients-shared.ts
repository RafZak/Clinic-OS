import type { LeadTemperature } from "@/lib/phone-tags";
import type { PsyTag } from "@/lib/psychology/tags";

export type PatientStatus = "prospect" | "patient" | "lost";

export type PatientRow = {
  id: string;
  label: string;
  age: number | null;
  status: PatientStatus;
  firstContactAt: Date | null;
  centerName: string | null;
  centerId: string | null;
  eventsCount: number;
  lastPastEventAt: Date | null;
  nextFutureEventAt: Date | null;
  consultationsCount: number;
  phoneCallsCount: number;
  avgConsultationScore: number | null;
  lastConsultationScore: number | null;
  lastPhoneTemperature: LeadTemperature | null;
  /** Tags du radar global (calculé depuis tous les snapshots du patient). Vide si aucun snapshot. */
  psyTags: PsyTag[];
  /** Consentement marketing actif au sens de hasActiveMarketingConsent. */
  marketingConsentActive: boolean;
};

export type PatientEventKind =
  | "phone_call"
  | "appointment_scheduled"
  | "consultation"
  | "trial_start"
  | "delivery"
  | "follow_up";

export type PatientEventRow = {
  id: string;
  kind: PatientEventKind;
  occurredAt: Date;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  sessionId: string | null;
  sessionKind: "consultation" | "phone_call" | null;
  sessionStatus: string | null;
  sessionGlobalScore: number | null;
  sessionDurationSeconds: number | null;
  sessionAnalysisStatus: string | null;
  sessionHasTranscript: boolean;
};

export const STATUS_LABEL: Record<PatientStatus, string> = {
  prospect: "Prospect",
  patient: "Gagné",
  lost: "Perdu",
};

export const STATUS_LABEL_EN: Record<PatientStatus, string> = {
  prospect: "Prospect",
  patient: "Won",
  lost: "Lost",
};

export const EVENT_LABEL: Record<PatientEventKind, string> = {
  phone_call: "Appel entrant",
  appointment_scheduled: "RDV pris",
  consultation: "Consultation",
  trial_start: "Début d'essai",
  delivery: "Livraison",
  follow_up: "Rappel de suivi",
};

export const EVENT_LABEL_EN: Record<PatientEventKind, string> = {
  phone_call: "Inbound call",
  appointment_scheduled: "Appointment booked",
  consultation: "Consultation",
  trial_start: "Trial start",
  delivery: "Delivery",
  follow_up: "Follow-up call",
};
