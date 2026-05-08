import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sessionPsychologySnapshots } from "@/db/schema";
import type { Locale } from "@/lib/locale";
import {
  LEAD_TEMPERATURES,
  type LeadTemperature,
} from "@/lib/phone-tags";
import {
  EVENT_LABEL,
  EVENT_LABEL_EN,
  STATUS_LABEL,
  STATUS_LABEL_EN,
  type PatientEventKind,
  type PatientEventRow,
  type PatientRow,
  type PatientStatus,
} from "@/lib/patients-shared";
import { computeGlobalTags } from "@/lib/psychology/aggregate";
import { type PsyRadar, type PsySnapshot } from "@/lib/psychology/axes";
import { hasActiveMarketingConsent } from "@/lib/psychology/consent";

export {
  EVENT_LABEL,
  EVENT_LABEL_EN,
  STATUS_LABEL,
  STATUS_LABEL_EN,
};
export type { PatientEventKind, PatientEventRow, PatientRow, PatientStatus };

type RawPatientRow = {
  id: string;
  label: string;
  age: number | null;
  status: string;
  first_contact_at: string | null;
  center_id: string | null;
  center_name: string | null;
  events_count: number;
  last_past_event_at: string | null;
  next_future_event_at: string | null;
  consultations_count: number;
  phone_calls_count: number;
  avg_consultation_score: number | null;
  last_consultation_score: number | null;
  last_phone_temperature: string | null;
  marketing_psy_consent_at: string | null;
  marketing_psy_revoked_at: string | null;
};

function toDate(v: string | null): Date | null {
  return v ? new Date(v) : null;
}

export async function listPatients(locale: Locale = "fr"): Promise<PatientRow[]> {
  const rows = await db.execute<RawPatientRow>(sql`
    SELECT
      p.id,
      p.label,
      p.age,
      p.status,
      p.first_contact_at,
      p.center_id,
      c.name AS center_name,
      coalesce(ev.events_count, 0)::int AS events_count,
      ev.last_past_event_at,
      ev.next_future_event_at,
      coalesce(s.consultations_count, 0)::int AS consultations_count,
      coalesce(s.phone_calls_count, 0)::int AS phone_calls_count,
      s.avg_consultation_score::int AS avg_consultation_score,
      s.last_consultation_score AS last_consultation_score,
      s.last_phone_temperature AS last_phone_temperature,
      p.marketing_psy_consent_at,
      p.marketing_psy_revoked_at
    FROM patients p
    LEFT JOIN centers c ON c.id = p.center_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS events_count,
        max(occurred_at) FILTER (WHERE occurred_at <= now()) AS last_past_event_at,
        min(occurred_at) FILTER (WHERE occurred_at > now()) AS next_future_event_at
      FROM patient_events
      WHERE patient_id = p.id
    ) ev ON true
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE kind = 'consultation') AS consultations_count,
        count(*) FILTER (WHERE kind = 'phone_call') AS phone_calls_count,
        avg(global_score) FILTER (WHERE kind = 'consultation' AND global_score IS NOT NULL) AS avg_consultation_score,
        (
          SELECT global_score FROM sessions
          WHERE patient_id = p.id AND kind = 'consultation' AND global_score IS NOT NULL
          ORDER BY started_at DESC NULLS LAST
          LIMIT 1
        ) AS last_consultation_score,
        (
          SELECT metadata->'tags'->>'lead_temperature' FROM sessions
          WHERE patient_id = p.id
            AND kind = 'phone_call'
            AND metadata->'tags'->>'lead_temperature' IS NOT NULL
          ORDER BY started_at DESC NULLS LAST
          LIMIT 1
        ) AS last_phone_temperature
      FROM sessions
      WHERE patient_id = p.id
    ) s ON true
    WHERE COALESCE(
      (
        SELECT metadata->>'locale'
        FROM sessions
        WHERE patient_id = p.id
        ORDER BY started_at DESC NULLS LAST
        LIMIT 1
      ),
      'fr'
    ) = ${locale}
    ORDER BY
      ev.last_past_event_at DESC NULLS LAST,
      ev.next_future_event_at ASC NULLS LAST,
      p.label ASC
  `);

  // Charge tous les snapshots psy pour les patients affichés en 1 query, puis
  // calcule le radar global / tags en TS via les helpers existants.
  const patientIds = rows.map((r) => r.id);
  const snapshotsByPatient = new Map<string, PsySnapshot[]>();
  if (patientIds.length > 0) {
    const snapshotRows = await db
      .select()
      .from(sessionPsychologySnapshots)
      .where(inArray(sessionPsychologySnapshots.patientId, patientIds));
    for (const row of snapshotRows) {
      const radar: PsyRadar = {
        acceptance: row.acceptanceScore,
        motivation: row.motivationScore,
        trust: row.trustScore,
        priceSensitivity: row.priceSensitivityScore,
        externalInfluence: row.externalInfluenceScore,
        decisionStage: row.decisionStageScore,
      };
      const snap: PsySnapshot = {
        id: row.id,
        sessionId: row.sessionId,
        patientId: row.patientId,
        radar,
        tags: row.tags,
        rawOutput: row.rawOutput,
        promptVersion: row.promptVersion,
        model: row.model,
        createdAt: row.createdAt,
      };
      const existing = snapshotsByPatient.get(row.patientId);
      if (existing) existing.push(snap);
      else snapshotsByPatient.set(row.patientId, [snap]);
    }
  }

  return rows.map((r) => {
    const snaps = snapshotsByPatient.get(r.id) ?? [];
    return {
      id: r.id,
      label: r.label,
      age: r.age,
      status: (r.status as PatientStatus) ?? "prospect",
      firstContactAt: toDate(r.first_contact_at),
      centerName: r.center_name,
      centerId: r.center_id,
      eventsCount: r.events_count,
      lastPastEventAt: toDate(r.last_past_event_at),
      nextFutureEventAt: toDate(r.next_future_event_at),
      consultationsCount: r.consultations_count,
      phoneCallsCount: r.phone_calls_count,
      avgConsultationScore: r.avg_consultation_score,
      lastConsultationScore: r.last_consultation_score,
      lastPhoneTemperature: LEAD_TEMPERATURES.includes(
        r.last_phone_temperature as LeadTemperature
      )
        ? (r.last_phone_temperature as LeadTemperature)
        : null,
      psyTags: computeGlobalTags(snaps),
      marketingConsentActive: hasActiveMarketingConsent({
        marketingPsyConsentAt: toDate(r.marketing_psy_consent_at),
        marketingPsyRevokedAt: toDate(r.marketing_psy_revoked_at),
      }),
    };
  });
}

export type PatientDetail = {
  patient: {
    id: string;
    label: string;
    age: number | null;
    status: PatientStatus;
    firstContactAt: Date | null;
    centerName: string | null;
    centerId: string | null;
    marketingPsyConsentAt: Date | null;
    marketingPsyRevokedAt: Date | null;
  };
  events: PatientEventRow[];
};

type RawEventRow = {
  id: string;
  kind: string;
  occurred_at: string;
  summary: string | null;
  metadata: unknown;
  session_id: string | null;
  session_kind: string | null;
  session_status: string | null;
  session_global_score: number | null;
  session_duration_seconds: number | null;
  session_analysis_status: string | null;
  session_has_transcript: boolean;
};

type RawPatientDetailRow = {
  id: string;
  label: string;
  age: number | null;
  status: string;
  first_contact_at: string | null;
  center_id: string | null;
  center_name: string | null;
  marketing_psy_consent_at: string | null;
  marketing_psy_revoked_at: string | null;
};

export async function getPatientDetail(
  patientId: string
): Promise<PatientDetail | null> {
  const headerRows = await db.execute<RawPatientDetailRow>(sql`
    SELECT
      p.id,
      p.label,
      p.age,
      p.status,
      p.first_contact_at,
      p.center_id,
      c.name AS center_name,
      p.marketing_psy_consent_at,
      p.marketing_psy_revoked_at
    FROM patients p
    LEFT JOIN centers c ON c.id = p.center_id
    WHERE p.id = ${patientId}
    LIMIT 1
  `);
  const head = headerRows[0];
  if (!head) return null;

  const eventRows = await db.execute<RawEventRow>(sql`
    SELECT
      e.id,
      e.kind,
      e.occurred_at,
      e.summary,
      e.metadata,
      e.session_id,
      s.kind AS session_kind,
      s.status AS session_status,
      s.global_score AS session_global_score,
      s.duration_seconds AS session_duration_seconds,
      s.analysis_status AS session_analysis_status,
      EXISTS(
        SELECT 1 FROM transcript_lines tl WHERE tl.session_id = s.id
      ) AS session_has_transcript
    FROM patient_events e
    LEFT JOIN sessions s ON s.id = e.session_id
    WHERE e.patient_id = ${patientId}
    ORDER BY e.occurred_at ASC, e.id ASC
  `);

  return {
    patient: {
      id: head.id,
      label: head.label,
      age: head.age,
      status: (head.status as PatientStatus) ?? "prospect",
      firstContactAt: toDate(head.first_contact_at),
      centerName: head.center_name,
      centerId: head.center_id,
      marketingPsyConsentAt: toDate(head.marketing_psy_consent_at),
      marketingPsyRevokedAt: toDate(head.marketing_psy_revoked_at),
    },
    events: eventRows.map((r) => ({
      id: r.id,
      kind: r.kind as PatientEventKind,
      occurredAt: new Date(r.occurred_at),
      summary: r.summary,
      metadata:
        r.metadata && typeof r.metadata === "object"
          ? (r.metadata as Record<string, unknown>)
          : null,
      sessionId: r.session_id,
      sessionKind:
        r.session_kind === "consultation" || r.session_kind === "phone_call"
          ? r.session_kind
          : null,
      sessionStatus: r.session_status,
      sessionGlobalScore: r.session_global_score,
      sessionDurationSeconds: r.session_duration_seconds,
      sessionAnalysisStatus: r.session_analysis_status,
      sessionHasTranscript: Boolean(r.session_has_transcript),
    })),
  };
}

export function patientSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
