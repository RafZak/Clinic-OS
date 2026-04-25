import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { PatientStatus } from "@/lib/patients-shared";

export type SidebarRecentPatient = {
  id: string;
  label: string;
  status: PatientStatus;
};

export type SidebarRecentSession = {
  id: string;
  kind: "consultation" | "phone_call";
  patientLabel: string;
  globalScore: number | null;
};

export type SidebarContext = {
  patientsAlerts: number;
  recentPatients: SidebarRecentPatient[];
  lastSession: SidebarRecentSession | null;
  vaultUpdatesToday: number;
};

export async function loadSidebarContext(): Promise<SidebarContext> {
  const [
    alertsRow,
    recents,
    lastSessionRows,
    vaultRow,
  ] = await Promise.all([
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM patients WHERE status = 'lost'
    `),
    db.execute<{
      id: string;
      label: string;
      status: string;
    }>(sql`
      SELECT p.id, p.label, p.status
      FROM patients p
      LEFT JOIN LATERAL (
        SELECT max(occurred_at) AS last_at
        FROM patient_events
        WHERE patient_id = p.id
      ) ev ON true
      WHERE ev.last_at IS NOT NULL
      ORDER BY ev.last_at DESC NULLS LAST
      LIMIT 3
    `),
    db.execute<{
      id: string;
      kind: string;
      patient_label: string;
      global_score: number | null;
    }>(sql`
      SELECT s.id, s.kind, p.label AS patient_label, s.global_score
      FROM sessions s
      LEFT JOIN patients p ON p.id = s.patient_id
      WHERE s.analysis_status = 'done'
        AND s.patient_id IS NOT NULL
      ORDER BY s.analyzed_at DESC NULLS LAST
      LIMIT 1
    `),
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
      FROM vault_pages
      WHERE updated_at >= date_trunc('day', now())
    `),
  ]);

  const last = lastSessionRows[0];

  return {
    patientsAlerts: alertsRow[0]?.n ?? 0,
    recentPatients: recents.map((r) => ({
      id: r.id,
      label: r.label,
      status: (r.status as PatientStatus) ?? "prospect",
    })),
    lastSession: last
      ? {
          id: last.id,
          kind: last.kind === "phone_call" ? "phone_call" : "consultation",
          patientLabel: last.patient_label,
          globalScore: last.global_score,
        }
      : null,
    vaultUpdatesToday: vaultRow[0]?.n ?? 0,
  };
}
