import type { PsyAxis, PsyRadar } from "../axes";
import type { PsyTag } from "../tags";

export type ExportLocale = "fr" | "en";
export type ConsentMode = "active" | "all";
export type ExportFormat = "csv" | "xlsx" | "json";

export type PatientStatus = "prospect" | "patient" | "lost";

export type PatientEventKind =
  | "phone_call"
  | "appointment_scheduled"
  | "consultation"
  | "trial_start"
  | "delivery"
  | "follow_up";

export type PsyAxisDetail = {
  score: number | null;
  rationale: string | null;
  verbatim: string | null;
  trend: "up" | "down" | "stable" | null;
  source_session_id: string | null;
};

export type TopInsight = {
  title: string;
  estimated_impact_eur: number | null;
  severity: "info" | "warning" | "critical";
  session_date: string;
};

export type Recommendation = {
  priority_segment: "hot" | "warm" | "cold" | "lost";
  urgency_score: number;
  recommended_channel: "phone" | "email" | "sms" | "in_person" | "no_touch";
  recommended_angle: string;
  next_best_action: string;
};

export type PatientExportRecord = {
  // 1. Identité
  patient_id: string;
  full_name: string;
  age: number | null;
  center_name: string | null;
  marketing_consent_at: string | null;

  // 2. Statut funnel
  status: PatientStatus;
  current_stage: PatientEventKind | null;
  first_contact_at: string | null;
  last_interaction_at: string | null;
  days_in_pipeline: number | null;
  days_in_current_stage: number | null;

  // 3. Engagement
  total_sessions: number;
  consultations_count: number;
  phone_calls_count: number;
  total_duration_minutes: number;
  avg_session_score: number | null;
  last_session_score: number | null;

  // 4. Profil psy global
  tags: PsyTag[];
  tags_label: string[];
  radar: PsyRadar;

  // 5. Profil psy enrichi (par axe, snake_case keys)
  radar_detail: Record<PsyAxis, PsyAxisDetail>;

  // 6. Opportunité commerciale
  opportunity: {
    total_estimated_eur: number;
    missed_objections_count: number;
    upsell_missed_count: number;
    top_insights: TopInsight[];
  };

  // 7. Recommandation marketing (null si Haiku échoue)
  recommendation: Recommendation | null;
};

/**
 * Données auxiliaires pour XLSX (feuilles Sessions/Insights/Timeline).
 * Le payload final XLSX expose ces tables en plus du PatientExportRecord.
 */
export type ExportSessionRow = {
  session_id: string;
  patient_id: string;
  kind: "consultation" | "phone_call";
  started_at: string;
  duration_seconds: number | null;
  global_score: number | null;
  summary: string | null;
};

export type ExportInsightRow = {
  insight_id: string;
  patient_id: string;
  session_id: string;
  type: string;
  severity: "info" | "warning" | "critical" | null;
  title: string;
  description: string;
  estimated_impact_eur: number | null;
};

export type ExportTimelineRow = {
  event_id: string;
  patient_id: string;
  kind: PatientEventKind;
  occurred_at: string;
  summary: string | null;
};

export type ExportPayload = {
  exported_at: string;
  locale: ExportLocale;
  consent_mode: ConsentMode;
  count: number;
  patients: PatientExportRecord[];
  sessions: ExportSessionRow[];
  insights: ExportInsightRow[];
  timeline: ExportTimelineRow[];
};
