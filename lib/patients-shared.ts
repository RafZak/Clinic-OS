export type PatientStatus = "prospect" | "patient" | "lost";

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

export const EVENT_LABEL: Record<PatientEventKind, string> = {
  phone_call: "Appel entrant",
  appointment_scheduled: "RDV pris",
  consultation: "Consultation",
  trial_start: "Début d'essai",
  delivery: "Livraison",
  follow_up: "Rappel de suivi",
};
