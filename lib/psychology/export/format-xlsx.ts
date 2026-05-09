import ExcelJS from "exceljs";
import { PSY_AXES } from "../axes";
import type {
  ExportInsightRow,
  ExportPayload,
  ExportSessionRow,
  ExportTimelineRow,
  PatientExportRecord,
} from "./types";

const BRAND_RED = "FFCC0641";
const HEADER_TEXT_WHITE = "FFFFFFFF";

const SHEET_LABELS = {
  fr: {
    patients: "Patients",
    sessions: "Sessions",
    insights: "Insights",
    timeline: "Timeline",
  },
  en: {
    patients: "Patients",
    sessions: "Sessions",
    insights: "Insights",
    timeline: "Timeline",
  },
} as const;

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: HEADER_TEXT_WHITE } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_RED },
  };
  row.height = 22;
}

function freezeFirstRow(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
}

function autoSizeColumns(sheet: ExcelJS.Worksheet, max = 60): void {
  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      if (v === null || v === undefined) return;
      const len = String(v).length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(max, maxLen + 2);
  });
}

function buildPatientsSheet(
  wb: ExcelJS.Workbook,
  payload: ExportPayload
): void {
  const labels = SHEET_LABELS[payload.locale];
  const sheet = wb.addWorksheet(labels.patients);

  const baseColumns = [
    { header: "patient_id", key: "patient_id" },
    { header: "full_name", key: "full_name" },
    { header: "age", key: "age" },
    { header: "center_name", key: "center_name" },
    { header: "marketing_consent_at", key: "marketing_consent_at" },
    { header: "status", key: "status" },
    { header: "current_stage", key: "current_stage" },
    { header: "first_contact_at", key: "first_contact_at" },
    { header: "last_interaction_at", key: "last_interaction_at" },
    { header: "days_in_pipeline", key: "days_in_pipeline" },
    { header: "days_in_current_stage", key: "days_in_current_stage" },
    { header: "total_sessions", key: "total_sessions" },
    { header: "consultations_count", key: "consultations_count" },
    { header: "phone_calls_count", key: "phone_calls_count" },
    { header: "total_duration_minutes", key: "total_duration_minutes" },
    { header: "avg_session_score", key: "avg_session_score" },
    { header: "last_session_score", key: "last_session_score" },
    { header: "tags", key: "tags" },
    { header: "tags_label", key: "tags_label" },
  ];

  const axisColumns = PSY_AXES.flatMap((a) => {
    const k = a === "priceSensitivity" ? "price_sensitivity"
      : a === "externalInfluence" ? "external_influence"
      : a === "decisionStage" ? "decision_stage"
      : a;
    return [
      { header: `psy_${k}_score`, key: `psy_${k}_score` },
      { header: `psy_${k}_rationale`, key: `psy_${k}_rationale` },
      { header: `psy_${k}_verbatim`, key: `psy_${k}_verbatim` },
      { header: `psy_${k}_trend`, key: `psy_${k}_trend` },
    ];
  });

  const oppColumns = [
    { header: "opportunity_total_eur", key: "opportunity_total_eur" },
    { header: "opportunity_missed_objections", key: "opportunity_missed_objections" },
    { header: "opportunity_upsell_missed", key: "opportunity_upsell_missed" },
    ...[1, 2, 3].flatMap((i) => [
      { header: `top_insight_${i}_title`, key: `top_insight_${i}_title` },
      { header: `top_insight_${i}_eur`, key: `top_insight_${i}_eur` },
      { header: `top_insight_${i}_severity`, key: `top_insight_${i}_severity` },
      { header: `top_insight_${i}_date`, key: `top_insight_${i}_date` },
    ]),
  ];

  const recoColumns = [
    { header: "reco_priority_segment", key: "reco_priority_segment" },
    { header: "reco_urgency_score", key: "reco_urgency_score" },
    { header: "reco_channel", key: "reco_channel" },
    { header: "reco_angle", key: "reco_angle" },
    { header: "reco_next_best_action", key: "reco_next_best_action" },
  ];

  sheet.columns = [...baseColumns, ...axisColumns, ...oppColumns, ...recoColumns];

  for (const p of payload.patients) {
    sheet.addRow(patientToFlatRow(p));
  }

  styleHeaderRow(sheet.getRow(1));
  freezeFirstRow(sheet);
  autoSizeColumns(sheet);
}

function patientToFlatRow(p: PatientExportRecord): Record<string, unknown> {
  const row: Record<string, unknown> = {
    patient_id: p.patient_id,
    full_name: p.full_name,
    age: p.age,
    center_name: p.center_name,
    marketing_consent_at: p.marketing_consent_at?.slice(0, 10) ?? null,
    status: p.status,
    current_stage: p.current_stage,
    first_contact_at: p.first_contact_at?.slice(0, 10) ?? null,
    last_interaction_at: p.last_interaction_at?.slice(0, 10) ?? null,
    days_in_pipeline: p.days_in_pipeline,
    days_in_current_stage: p.days_in_current_stage,
    total_sessions: p.total_sessions,
    consultations_count: p.consultations_count,
    phone_calls_count: p.phone_calls_count,
    total_duration_minutes: p.total_duration_minutes,
    avg_session_score: p.avg_session_score,
    last_session_score: p.last_session_score,
    tags: p.tags.join("|"),
    tags_label: p.tags_label.join("|"),
  };

  for (const axis of PSY_AXES) {
    const k = axis === "priceSensitivity" ? "price_sensitivity"
      : axis === "externalInfluence" ? "external_influence"
      : axis === "decisionStage" ? "decision_stage"
      : axis;
    const d = p.radar_detail[axis];
    row[`psy_${k}_score`] = d.score;
    row[`psy_${k}_rationale`] = d.rationale;
    row[`psy_${k}_verbatim`] = d.verbatim;
    row[`psy_${k}_trend`] = d.trend;
  }

  row.opportunity_total_eur = p.opportunity.total_estimated_eur;
  row.opportunity_missed_objections = p.opportunity.missed_objections_count;
  row.opportunity_upsell_missed = p.opportunity.upsell_missed_count;
  for (let i = 0; i < 3; i++) {
    const ins = p.opportunity.top_insights[i];
    row[`top_insight_${i + 1}_title`] = ins?.title ?? null;
    row[`top_insight_${i + 1}_eur`] = ins?.estimated_impact_eur ?? null;
    row[`top_insight_${i + 1}_severity`] = ins?.severity ?? null;
    row[`top_insight_${i + 1}_date`] = ins?.session_date ?? null;
  }

  row.reco_priority_segment = p.recommendation?.priority_segment ?? null;
  row.reco_urgency_score = p.recommendation?.urgency_score ?? null;
  row.reco_channel = p.recommendation?.recommended_channel ?? null;
  row.reco_angle = p.recommendation?.recommended_angle ?? null;
  row.reco_next_best_action = p.recommendation?.next_best_action ?? null;

  return row;
}

function buildSessionsSheet(wb: ExcelJS.Workbook, rows: ExportSessionRow[], locale: ExportPayload["locale"]): void {
  const sheet = wb.addWorksheet(SHEET_LABELS[locale].sessions);
  sheet.columns = [
    { header: "session_id", key: "session_id", width: 38 },
    { header: "patient_id", key: "patient_id", width: 38 },
    { header: "kind", key: "kind", width: 14 },
    { header: "started_at", key: "started_at", width: 22 },
    { header: "duration_seconds", key: "duration_seconds", width: 16 },
    { header: "global_score", key: "global_score", width: 12 },
    { header: "summary", key: "summary", width: 60 },
  ];
  rows.forEach((r) => sheet.addRow(r));
  styleHeaderRow(sheet.getRow(1));
  freezeFirstRow(sheet);
}

function buildInsightsSheet(wb: ExcelJS.Workbook, rows: ExportInsightRow[], locale: ExportPayload["locale"]): void {
  const sheet = wb.addWorksheet(SHEET_LABELS[locale].insights);
  sheet.columns = [
    { header: "insight_id", key: "insight_id", width: 38 },
    { header: "patient_id", key: "patient_id", width: 38 },
    { header: "session_id", key: "session_id", width: 38 },
    { header: "type", key: "type", width: 18 },
    { header: "severity", key: "severity", width: 10 },
    { header: "title", key: "title", width: 50 },
    { header: "description", key: "description", width: 60 },
    { header: "estimated_impact_eur", key: "estimated_impact_eur", width: 16 },
  ];
  rows.forEach((r) => sheet.addRow(r));
  styleHeaderRow(sheet.getRow(1));
  freezeFirstRow(sheet);
}

function buildTimelineSheet(wb: ExcelJS.Workbook, rows: ExportTimelineRow[], locale: ExportPayload["locale"]): void {
  const sheet = wb.addWorksheet(SHEET_LABELS[locale].timeline);
  sheet.columns = [
    { header: "event_id", key: "event_id", width: 38 },
    { header: "patient_id", key: "patient_id", width: 38 },
    { header: "kind", key: "kind", width: 22 },
    { header: "occurred_at", key: "occurred_at", width: 22 },
    { header: "summary", key: "summary", width: 60 },
  ];
  rows.forEach((r) => sheet.addRow(r));
  styleHeaderRow(sheet.getRow(1));
  freezeFirstRow(sheet);
}

export async function formatXlsx(payload: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Clinic OS";
  wb.created = new Date();

  buildPatientsSheet(wb, payload);
  buildSessionsSheet(wb, payload.sessions, payload.locale);
  buildInsightsSheet(wb, payload.insights, payload.locale);
  buildTimelineSheet(wb, payload.timeline, payload.locale);

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}
