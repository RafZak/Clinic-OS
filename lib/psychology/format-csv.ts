import type { PsyRadar } from "./axes";
import type { PsyTag } from "./tags";

export type PsyExportRow = {
  patientId: string;
  fullName: string;
  age: number | null;
  centerName: string | null;
  lastSessionDate: Date | null;
  tags: PsyTag[];
  globalRadar: PsyRadar;
  consentAt: Date | null;
};

const HEADER = [
  "patient_id",
  "full_name",
  "age",
  "center_name",
  "last_session_date",
  "tags",
  "acceptance",
  "motivation",
  "trust",
  "price_sensitivity",
  "external_influence",
  "decision_stage",
  "consent_at",
] as const;

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function formatPsychologyCsv(rows: PsyExportRow[]): string {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.patientId),
        csvCell(r.fullName),
        csvCell(r.age),
        csvCell(r.centerName),
        csvCell(isoDate(r.lastSessionDate)),
        csvCell(r.tags.join("|")),
        csvCell(r.globalRadar.acceptance),
        csvCell(r.globalRadar.motivation),
        csvCell(r.globalRadar.trust),
        csvCell(r.globalRadar.priceSensitivity),
        csvCell(r.globalRadar.externalInfluence),
        csvCell(r.globalRadar.decisionStage),
        csvCell(isoDate(r.consentAt)),
      ].join(",")
    );
  }
  return lines.join("\n");
}
