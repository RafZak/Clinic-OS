import { PSY_AXES, type PsyAxis } from "../axes";
import type { ExportPayload, PatientExportRecord } from "./types";

const AXIS_KEY: Record<PsyAxis, string> = {
  acceptance: "acceptance",
  motivation: "motivation",
  trust: "trust",
  priceSensitivity: "price_sensitivity",
  externalInfluence: "external_influence",
  decisionStage: "decision_stage",
};

const HEADER = [
  // 1. Identité
  "patient_id",
  "full_name",
  "age",
  "center_name",
  "marketing_consent_at",
  // 2. Funnel
  "status",
  "current_stage",
  "first_contact_at",
  "last_interaction_at",
  "days_in_pipeline",
  "days_in_current_stage",
  // 3. Engagement
  "total_sessions",
  "consultations_count",
  "phone_calls_count",
  "total_duration_minutes",
  "avg_session_score",
  "last_session_score",
  // 4. Tags
  "tags",
  "tags_label",
  // 5. Psy radar (score + rationale + verbatim + trend)
  ...PSY_AXES.flatMap((a) => [
    `psy_${AXIS_KEY[a]}_score`,
    `psy_${AXIS_KEY[a]}_rationale`,
    `psy_${AXIS_KEY[a]}_verbatim`,
    `psy_${AXIS_KEY[a]}_trend`,
  ]),
  // 6. Opportunity
  "opportunity_total_eur",
  "opportunity_missed_objections",
  "opportunity_upsell_missed",
  "top_insight_1_title",
  "top_insight_1_eur",
  "top_insight_1_severity",
  "top_insight_1_date",
  "top_insight_2_title",
  "top_insight_2_eur",
  "top_insight_2_severity",
  "top_insight_2_date",
  "top_insight_3_title",
  "top_insight_3_eur",
  "top_insight_3_severity",
  "top_insight_3_date",
  // 7. Reco
  "reco_priority_segment",
  "reco_urgency_score",
  "reco_channel",
  "reco_angle",
  "reco_next_best_action",
] as const;

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function patientRowToCells(p: PatientExportRecord): string[] {
  const cells: string[] = [
    csvCell(p.patient_id),
    csvCell(p.full_name),
    csvCell(p.age),
    csvCell(p.center_name),
    csvCell(isoDateOnly(p.marketing_consent_at)),

    csvCell(p.status),
    csvCell(p.current_stage),
    csvCell(isoDateOnly(p.first_contact_at)),
    csvCell(isoDateOnly(p.last_interaction_at)),
    csvCell(p.days_in_pipeline),
    csvCell(p.days_in_current_stage),

    csvCell(p.total_sessions),
    csvCell(p.consultations_count),
    csvCell(p.phone_calls_count),
    csvCell(p.total_duration_minutes),
    csvCell(p.avg_session_score),
    csvCell(p.last_session_score),

    csvCell(p.tags.join("|")),
    csvCell(p.tags_label.join("|")),
  ];

  for (const axis of PSY_AXES) {
    const d = p.radar_detail[axis];
    cells.push(csvCell(d.score));
    cells.push(csvCell(d.rationale));
    cells.push(csvCell(d.verbatim));
    cells.push(csvCell(d.trend));
  }

  cells.push(csvCell(p.opportunity.total_estimated_eur));
  cells.push(csvCell(p.opportunity.missed_objections_count));
  cells.push(csvCell(p.opportunity.upsell_missed_count));

  for (let i = 0; i < 3; i++) {
    const ins = p.opportunity.top_insights[i];
    cells.push(csvCell(ins?.title ?? null));
    cells.push(csvCell(ins?.estimated_impact_eur ?? null));
    cells.push(csvCell(ins?.severity ?? null));
    cells.push(csvCell(ins?.session_date ?? null));
  }

  cells.push(csvCell(p.recommendation?.priority_segment ?? null));
  cells.push(csvCell(p.recommendation?.urgency_score ?? null));
  cells.push(csvCell(p.recommendation?.recommended_channel ?? null));
  cells.push(csvCell(p.recommendation?.recommended_angle ?? null));
  cells.push(csvCell(p.recommendation?.next_best_action ?? null));

  return cells;
}

export function formatCsv(payload: ExportPayload): string {
  const lines = [HEADER.join(",")];
  for (const p of payload.patients) {
    lines.push(patientRowToCells(p).join(","));
  }
  return lines.join("\n");
}
