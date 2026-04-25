import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Role } from "@/lib/role";
import type { FrameworkKind } from "@/lib/frameworks";
import { getFramework, FRAMEWORK_LABEL } from "@/lib/frameworks";

export type DashboardKpi = {
  label: string;
  value: string;
  hint?: string;
};

export type WeeklyScorePoint = {
  weekLabel: string;
  weekStart: Date;
  consultations: number;
  avgScore: number | null;
};

export type StepHeatmapCell = {
  number: number;
  name: string;
  avgScore: number | null;
  coverageRatio: number;
};

export type RecentSessionRow = {
  id: string;
  patientLabel: string;
  practitionerName: string | null;
  centerName: string | null;
  globalScore: number | null;
  durationSeconds: number | null;
  startedAt: Date | null;
  kind: "consultation" | "phone_call";
};

export type DashboardContext = {
  totalPatients: number;
  fittedPatients: number;
  appointmentsCount: number;
  consultationsCount: number;
  phoneCallsCount: number;
  honoredAppointments: number;
  basketAvgEur: number | null;
  callDurationAvgSec: number | null;
  practitionerAvgScore: number | null;
  assistantAvgScore: number | null;
  uncalledLostPatient:
    | { id: string; label: string; daysSinceContact: number }
    | null;
  lastConsultation:
    | {
        id: string;
        patientLabel: string;
        score: number | null;
        daysAgo: number;
      }
    | null;
  lowestStep: { number: number; name: string; avgScore: number } | null;
  upsellOpportunity:
    | {
        patientId: string;
        patientLabel: string;
        product: string;
        price: number;
      }
    | null;
};

export type DashboardData = {
  role: Role;
  frameworkKind: FrameworkKind;
  frameworkLabel: string;
  kpis: DashboardKpi[];
  weekly: WeeklyScorePoint[];
  heatmap: StepHeatmapCell[];
  recentSessions: RecentSessionRow[];
  context: DashboardContext;
};

const WEEKS_BACK = 4;

function startOfWeek(d: Date): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}

export async function loadDashboard(role: Role): Promise<DashboardData> {
  const frameworkKind: FrameworkKind =
    role === "audioprothesiste" ? "consultation" : "phone_call";

  const ctxBase = await loadContext();
  const heatmap = await loadHeatmap(frameworkKind);

  const lowestStep = heatmap.reduce<DashboardContext["lowestStep"]>(
    (acc, cell) => {
      if (cell.avgScore == null) return acc;
      if (!acc || cell.avgScore < acc.avgScore) {
        return {
          number: cell.number,
          name: cell.name,
          avgScore: cell.avgScore,
        };
      }
      return acc;
    },
    null
  );
  const context: DashboardContext = { ...ctxBase, lowestStep };

  const kpis =
    role === "audioprothesiste"
      ? buildPractitionerKpis(context)
      : buildAssistantKpis(context);

  const [weekly, recentSessions] = await Promise.all([
    loadWeeklyScores(frameworkKind),
    loadRecentSessions(frameworkKind),
  ]);

  return {
    role,
    frameworkKind,
    frameworkLabel: FRAMEWORK_LABEL[frameworkKind],
    kpis,
    weekly,
    heatmap,
    recentSessions,
    context,
  };
}

async function loadContext(): Promise<Omit<DashboardContext, "lowestStep">> {
  const [
    patientsRow,
    eventsRow,
    honoredRow,
    basketRow,
    callRow,
    practScoreRow,
    assistScoreRow,
    uncalledRow,
    lastConsultRow,
    upsellRow,
  ] = await Promise.all([
    db.execute<{ total: number; fitted: number; lost: number }>(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'patient')::int AS fitted,
        count(*) FILTER (WHERE status = 'lost')::int AS lost
      FROM patients
    `),
    db.execute<{
      phone_calls: number;
      appointments: number;
      consultations: number;
    }>(sql`
      SELECT
        count(*) FILTER (WHERE kind = 'phone_call')::int AS phone_calls,
        count(*) FILTER (WHERE kind = 'appointment_scheduled')::int AS appointments,
        count(*) FILTER (WHERE kind = 'consultation')::int AS consultations
      FROM patient_events
    `),
    db.execute<{ honored: number }>(sql`
      SELECT count(DISTINCT pa.patient_id)::int AS honored
      FROM patient_events pa
      JOIN patient_events pc
        ON pc.patient_id = pa.patient_id
       AND pc.kind = 'consultation'
       AND pc.occurred_at >= pa.occurred_at
      WHERE pa.kind = 'appointment_scheduled'
    `),
    db.execute<{ avg: number | null }>(sql`
      SELECT avg(price_eur)::int AS avg
      FROM (
        SELECT DISTINCT ON (patient_id)
          (metadata->>'price_eur')::int AS price_eur
        FROM patient_events
        WHERE kind IN ('trial_start', 'delivery')
          AND metadata->>'price_eur' IS NOT NULL
        ORDER BY
          patient_id,
          CASE kind WHEN 'delivery' THEN 0 ELSE 1 END,
          occurred_at DESC
      ) AS one_per_patient
    `),
    db.execute<{ avg: number | null }>(sql`
      SELECT avg(duration_seconds)::int AS avg
      FROM sessions
      WHERE kind = 'phone_call'
        AND duration_seconds IS NOT NULL
        AND patient_id IS NOT NULL
    `),
    db.execute<{ avg: number | null }>(sql`
      SELECT avg(global_score)::int AS avg
      FROM sessions
      WHERE kind = 'consultation'
        AND analysis_status = 'done'
        AND global_score IS NOT NULL
        AND patient_id IS NOT NULL
    `),
    db.execute<{ avg: number | null }>(sql`
      SELECT avg(global_score)::int AS avg
      FROM sessions
      WHERE kind = 'phone_call'
        AND analysis_status = 'done'
        AND global_score IS NOT NULL
        AND patient_id IS NOT NULL
    `),
    db.execute<{
      id: string | null;
      label: string | null;
      first_contact_at: string | null;
    }>(sql`
      SELECT id, label, first_contact_at
      FROM patients
      WHERE status = 'lost'
      ORDER BY first_contact_at ASC NULLS LAST
      LIMIT 1
    `),
    db.execute<{
      id: string | null;
      label: string | null;
      global_score: number | null;
      analyzed_at: string | null;
    }>(sql`
      SELECT s.id, p.label, s.global_score, s.analyzed_at
      FROM sessions s
      LEFT JOIN patients p ON p.id = s.patient_id
      WHERE s.kind = 'consultation'
        AND s.analysis_status = 'done'
      ORDER BY s.analyzed_at DESC NULLS LAST
      LIMIT 1
    `),
    db.execute<{
      patient_id: string | null;
      patient_label: string | null;
      product: string | null;
      price_eur: number | null;
    }>(sql`
      SELECT
        e.patient_id,
        p.label AS patient_label,
        e.metadata->>'product' AS product,
        (e.metadata->>'price_eur')::int AS price_eur
      FROM patient_events e
      JOIN patients p ON p.id = e.patient_id
      WHERE e.kind = 'trial_start'
        AND (e.metadata->>'upsell_missed')::boolean = true
        AND p.status = 'prospect'
      ORDER BY e.occurred_at DESC
      LIMIT 1
    `),
  ]);

  const lostRow = uncalledRow[0];
  const uncalledLostPatient =
    lostRow?.id && lostRow.label && lostRow.first_contact_at
      ? {
          id: lostRow.id,
          label: lostRow.label,
          daysSinceContact: Math.max(
            1,
            Math.round(
              (Date.now() - new Date(lostRow.first_contact_at).getTime()) /
                86_400_000
            )
          ),
        }
      : null;

  const lastConsult = lastConsultRow[0];
  const lastConsultation =
    lastConsult?.id && lastConsult.label && lastConsult.analyzed_at
      ? {
          id: lastConsult.id,
          patientLabel: lastConsult.label,
          score: lastConsult.global_score,
          daysAgo: Math.max(
            0,
            Math.round(
              (Date.now() - new Date(lastConsult.analyzed_at).getTime()) /
                86_400_000
            )
          ),
        }
      : null;

  const upsell = upsellRow[0];
  const upsellOpportunity =
    upsell?.patient_id &&
    upsell.patient_label &&
    upsell.product &&
    upsell.price_eur != null
      ? {
          patientId: upsell.patient_id,
          patientLabel: upsell.patient_label,
          product: upsell.product,
          price: upsell.price_eur,
        }
      : null;

  return {
    totalPatients: patientsRow[0]?.total ?? 0,
    fittedPatients: patientsRow[0]?.fitted ?? 0,
    appointmentsCount: eventsRow[0]?.appointments ?? 0,
    consultationsCount: eventsRow[0]?.consultations ?? 0,
    phoneCallsCount: eventsRow[0]?.phone_calls ?? 0,
    honoredAppointments: honoredRow[0]?.honored ?? 0,
    basketAvgEur: basketRow[0]?.avg ?? null,
    callDurationAvgSec: callRow[0]?.avg ?? null,
    practitionerAvgScore: practScoreRow[0]?.avg ?? null,
    assistantAvgScore: assistScoreRow[0]?.avg ?? null,
    uncalledLostPatient,
    lastConsultation,
    upsellOpportunity,
  };
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 100)} %`;
}

function buildPractitionerKpis(ctx: DashboardContext): DashboardKpi[] {
  const fittedDen = ctx.consultationsCount > 0 ? ctx.consultationsCount : 0;
  return [
    {
      label: "Taux de concrétisation",
      value: pct(ctx.fittedPatients, fittedDen || ctx.totalPatients),
      hint: `${ctx.fittedPatients} patients équipés sur ${
        fittedDen || ctx.totalPatients
      } consultés`,
    },
    {
      label: "Panier moyen",
      value:
        ctx.basketAvgEur != null
          ? `${ctx.basketAvgEur.toLocaleString("fr-FR")} €`
          : "—",
      hint: "Prix moyen par patient appareillé",
    },
    {
      label: "Score consultations moyen",
      value:
        ctx.practitionerAvgScore != null
          ? `${ctx.practitionerAvgScore}/100`
          : "—",
      hint: ctx.lastConsultation?.patientLabel
        ? `Dernière : ${ctx.lastConsultation.patientLabel}`
        : "Sur consultations analysées",
    },
  ];
}

function buildAssistantKpis(ctx: DashboardContext): DashboardKpi[] {
  const dur = ctx.callDurationAvgSec;
  return [
    {
      label: "Durée moyenne appel",
      value:
        dur != null
          ? `${Math.floor(dur / 60)}m ${(dur % 60).toString().padStart(2, "0")}s`
          : "—",
      hint: "Cible : ≤ 2 min",
    },
    {
      label: "Score qualité accueil",
      value:
        ctx.assistantAvgScore != null
          ? `${ctx.assistantAvgScore}/100`
          : "—",
      hint: "Framework appel — 6 étapes",
    },
  ];
}

async function loadWeeklyScores(
  kind: FrameworkKind
): Promise<WeeklyScorePoint[]> {
  const rows = await db.execute<{
    week_start: string;
    avg_score: number | null;
    sample_count: number;
  }>(sql`
    SELECT
      to_char(date_trunc('week', started_at), 'YYYY-MM-DD') AS week_start,
      avg(global_score)::int AS avg_score,
      count(*)::int AS sample_count
    FROM sessions
    WHERE kind = ${kind}
      AND analysis_status = 'done'
      AND global_score IS NOT NULL
      AND patient_id IS NOT NULL
      AND started_at >= now() - interval '${sql.raw(String(WEEKS_BACK))} weeks'
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const map = new Map<string, { avg: number | null; count: number }>();
  for (const r of rows) {
    map.set(r.week_start, { avg: r.avg_score, count: r.sample_count });
  }

  const points: WeeklyScorePoint[] = [];
  const today = startOfWeek(new Date());
  for (let i = WEEKS_BACK - 1; i >= 0; i--) {
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - i * 7);
    const key = weekStart.toISOString().slice(0, 10);
    const hit = map.get(key);
    points.push({
      weekStart,
      weekLabel: i === 0 ? "Cette sem." : `S-${i}`,
      consultations: hit?.count ?? 0,
      avgScore: hit?.avg ?? null,
    });
  }
  return points;
}

async function loadHeatmap(kind: FrameworkKind): Promise<StepHeatmapCell[]> {
  const framework = getFramework(kind);

  const rows = await db.execute<{
    step_number: number;
    avg_score: number | null;
    coverage: number;
    total_sessions: number;
  }>(sql`
    SELECT
      ss.step_number,
      avg(ss.score)::int AS avg_score,
      count(*) FILTER (WHERE ss.score IS NOT NULL)::int AS coverage,
      count(*)::int AS total_sessions
    FROM session_scores ss
    JOIN sessions s ON s.id = ss.session_id
    WHERE s.kind = ${kind}
      AND s.analysis_status = 'done'
      AND s.patient_id IS NOT NULL
    GROUP BY ss.step_number
    ORDER BY ss.step_number ASC
  `);

  const map = new Map<
    number,
    { avg: number | null; coverage: number; total: number }
  >();
  for (const r of rows) {
    map.set(r.step_number, {
      avg: r.avg_score,
      coverage: r.coverage,
      total: r.total_sessions,
    });
  }

  return framework.map((step) => {
    const hit = map.get(step.number);
    return {
      number: step.number,
      name: step.name,
      avgScore: hit?.avg ?? null,
      coverageRatio: hit && hit.total > 0 ? hit.coverage / hit.total : 0,
    };
  });
}

async function loadRecentSessions(
  kind: FrameworkKind
): Promise<RecentSessionRow[]> {
  const rows = await db.execute<{
    id: string;
    patient_label: string;
    practitioner_name: string | null;
    center_name: string | null;
    global_score: number | null;
    duration_seconds: number | null;
    started_at: string | null;
    kind: string;
  }>(sql`
    SELECT
      s.id,
      p.label AS patient_label,
      pr.full_name AS practitioner_name,
      c.name AS center_name,
      s.global_score,
      s.duration_seconds,
      s.started_at,
      s.kind
    FROM sessions s
    LEFT JOIN patients p ON p.id = s.patient_id
    LEFT JOIN practitioners pr ON pr.id = s.practitioner_id
    LEFT JOIN centers c ON c.id = pr.center_id
    WHERE s.kind = ${kind}
      AND s.analysis_status = 'done'
      AND s.patient_id IS NOT NULL
    ORDER BY s.analyzed_at DESC NULLS LAST, s.started_at DESC NULLS LAST
    LIMIT 5
  `);

  return rows.map((r) => ({
    id: r.id,
    patientLabel: r.patient_label,
    practitionerName: r.practitioner_name,
    centerName: r.center_name,
    globalScore: r.global_score,
    durationSeconds: r.duration_seconds,
    startedAt: r.started_at ? new Date(r.started_at) : null,
    kind: r.kind === "phone_call" ? "phone_call" : "consultation",
  }));
}
