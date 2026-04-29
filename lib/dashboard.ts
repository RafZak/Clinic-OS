import "server-only";
import { sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import type { Role } from "@/lib/role";
import type { Locale } from "@/lib/locale";
import type { FrameworkKind } from "@/lib/frameworks";
import { getScorableFramework, getStepName } from "@/lib/frameworks";

export type DashboardKpiKind =
  | "conversion"
  | "basket"
  | "score"
  | "callDuration"
  | "callScore";

export type DashboardKpi = {
  kind: DashboardKpiKind;
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

export type UpcomingAppointment = {
  id: string;
  patientId: string;
  patientLabel: string;
  patientStatus: "prospect" | "patient" | "lost";
  scheduledFor: string;
  durationMinutes: number | null;
  summary: string | null;
};

export type CalendarGrid = {
  gridStart: string;
  primaryMonthStart: string;
  appointments: UpcomingAppointment[];
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
  trialInProgress:
    | {
        patientId: string;
        patientLabel: string;
        product: string | null;
        daysSinceTrial: number;
      }
    | null;
  prospectToFollowUp:
    | {
        sessionId: string;
        patientId: string;
        patientLabel: string;
        score: number | null;
        daysSinceConsult: number;
      }
    | null;
  lowScoreToDebrief:
    | {
        sessionId: string;
        patientLabel: string;
        score: number;
        daysAgo: number;
      }
    | null;
};

export type DashboardData = {
  role: Role;
  locale: Locale;
  frameworkKind: FrameworkKind;
  frameworkLabel: string;
  kpis: DashboardKpi[];
  weekly: WeeklyScorePoint[];
  heatmap: StepHeatmapCell[];
  calendar: CalendarGrid;
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

function eurFormat(locale: Locale, n: number): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function loadDashboard(
  role: Role,
  locale: Locale
): Promise<DashboardData> {
  const frameworkKind: FrameworkKind =
    role === "audioprothesiste" ? "consultation" : "phone_call";

  const [tFw, tDash, tWeek] = await Promise.all([
    getTranslations("framework"),
    getTranslations("dashboard"),
    getTranslations("dashboard"),
  ]);

  const ctxBase = await loadContext(locale);
  const heatmap = await loadHeatmap(frameworkKind, locale);

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
      ? buildPractitionerKpis(context, locale, tDash)
      : buildAssistantKpis(context, locale, tDash);

  const [weekly, calendar] = await Promise.all([
    loadWeeklyScores(frameworkKind, locale, tWeek),
    loadCalendarGrid(locale),
  ]);

  return {
    role,
    locale,
    frameworkKind,
    frameworkLabel: tFw(frameworkKind),
    kpis,
    weekly,
    heatmap,
    calendar,
    context,
  };
}

const GRID_DAYS = 28;

async function loadCalendarGrid(locale: Locale): Promise<CalendarGrid> {
  const today = new Date();
  const gridStart = startOfWeek(today);
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + GRID_DAYS);

  const monthCount = new Map<string, number>();
  for (let i = 0; i < GRID_DAYS; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}`;
    monthCount.set(key, (monthCount.get(key) ?? 0) + 1);
  }
  const primaryMonthKey = Array.from(monthCount.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0][0];
  const [py, pm] = primaryMonthKey.split("-").map((n) => parseInt(n, 10));
  const primaryMonthStart = new Date(Date.UTC(py, pm - 1, 1));

  const rows = await db.execute<{
    id: string;
    patient_id: string;
    patient_label: string;
    patient_status: string;
    scheduled_for: string;
    duration_minutes: number | null;
    summary: string | null;
  }>(sql`
    SELECT
      pe.id,
      pe.patient_id,
      p.label AS patient_label,
      p.status AS patient_status,
      (pe.metadata->>'scheduled_for')::timestamptz AS scheduled_for,
      NULLIF(pe.metadata->>'duration_minutes', '')::int AS duration_minutes,
      pe.summary
    FROM patient_events pe
    JOIN patients p ON p.id = pe.patient_id
    WHERE pe.kind = 'appointment_scheduled'
      AND pe.metadata->>'scheduled_for' IS NOT NULL
      AND (pe.metadata->>'scheduled_for')::timestamptz >= ${gridStart.toISOString()}::timestamptz
      AND (pe.metadata->>'scheduled_for')::timestamptz < ${gridEnd.toISOString()}::timestamptz
      AND COALESCE(
        (
          SELECT metadata->>'locale'
          FROM sessions
          WHERE patient_id = pe.patient_id
          ORDER BY started_at DESC NULLS LAST
          LIMIT 1
        ),
        'fr'
      ) = ${locale}
    ORDER BY (pe.metadata->>'scheduled_for')::timestamptz ASC
  `);

  return {
    gridStart: gridStart.toISOString(),
    primaryMonthStart: primaryMonthStart.toISOString(),
    appointments: rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      patientLabel: r.patient_label,
      patientStatus: (r.patient_status as "prospect" | "patient" | "lost") ?? "prospect",
      scheduledFor: r.scheduled_for,
      durationMinutes: r.duration_minutes,
      summary: r.summary,
    })),
  };
}

async function loadContext(
  locale: Locale
): Promise<Omit<DashboardContext, "lowestStep">> {
  // A patient belongs to the current locale if their latest session's
  // metadata.locale matches — defaulting to 'fr' for legacy patients
  // that have no session at all (or sessions without metadata.locale).
  const patientLocaleFilter = sql`
    COALESCE(
      (
        SELECT metadata->>'locale'
        FROM sessions
        WHERE patient_id = patients.id
        ORDER BY started_at DESC NULLS LAST
        LIMIT 1
      ),
      'fr'
    ) = ${locale}
  `;
  const sessionLocaleFilter = sql`
    COALESCE(metadata->>'locale', 'fr') = ${locale}
  `;
  const eventLocaleFilter = sql`
    COALESCE(
      (
        SELECT metadata->>'locale'
        FROM sessions
        WHERE patient_id = patient_events.patient_id
        ORDER BY started_at DESC NULLS LAST
        LIMIT 1
      ),
      'fr'
    ) = ${locale}
  `;

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
    trialInProgressRow,
    prospectFollowUpRow,
    lowScoreRow,
  ] = await Promise.all([
    db.execute<{ total: number; fitted: number; lost: number }>(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'patient')::int AS fitted,
        count(*) FILTER (WHERE status = 'lost')::int AS lost
      FROM patients
      WHERE ${patientLocaleFilter}
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
      WHERE ${eventLocaleFilter}
    `),
    db.execute<{ honored: number }>(sql`
      SELECT count(DISTINCT pa.patient_id)::int AS honored
      FROM patient_events pa
      JOIN patient_events pc
        ON pc.patient_id = pa.patient_id
       AND pc.kind = 'consultation'
       AND pc.occurred_at >= pa.occurred_at
      WHERE pa.kind = 'appointment_scheduled'
        AND COALESCE(
          (
            SELECT metadata->>'locale'
            FROM sessions
            WHERE patient_id = pa.patient_id
            ORDER BY started_at DESC NULLS LAST
            LIMIT 1
          ),
          'fr'
        ) = ${locale}
    `),
    db.execute<{ avg: number | null }>(sql`
      SELECT avg(price_eur)::int AS avg
      FROM (
        SELECT DISTINCT ON (patient_id)
          patient_id,
          (metadata->>'price_eur')::int AS price_eur
        FROM patient_events
        WHERE kind IN ('trial_start', 'delivery')
          AND metadata->>'price_eur' IS NOT NULL
          AND COALESCE(
            (
              SELECT metadata->>'locale'
              FROM sessions
              WHERE patient_id = patient_events.patient_id
              ORDER BY started_at DESC NULLS LAST
              LIMIT 1
            ),
            'fr'
          ) = ${locale}
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
        AND ${sessionLocaleFilter}
    `),
    db.execute<{ avg: number | null }>(sql`
      SELECT avg(global_score)::int AS avg
      FROM sessions
      WHERE kind = 'consultation'
        AND analysis_status = 'done'
        AND global_score IS NOT NULL
        AND patient_id IS NOT NULL
        AND ${sessionLocaleFilter}
    `),
    db.execute<{ avg: number | null }>(sql`
      SELECT avg(global_score)::int AS avg
      FROM sessions
      WHERE kind = 'phone_call'
        AND analysis_status = 'done'
        AND global_score IS NOT NULL
        AND patient_id IS NOT NULL
        AND ${sessionLocaleFilter}
    `),
    db.execute<{
      id: string | null;
      label: string | null;
      first_contact_at: string | null;
    }>(sql`
      SELECT id, label, first_contact_at
      FROM patients
      WHERE status = 'lost'
        AND ${patientLocaleFilter}
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
        AND COALESCE(s.metadata->>'locale', 'fr') = ${locale}
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
        AND COALESCE(
          (
            SELECT metadata->>'locale'
            FROM sessions
            WHERE patient_id = e.patient_id
            ORDER BY started_at DESC NULLS LAST
            LIMIT 1
          ),
          'fr'
        ) = ${locale}
      ORDER BY e.occurred_at DESC
      LIMIT 1
    `),
    db.execute<{
      patient_id: string;
      patient_label: string;
      product: string | null;
      occurred_at: string;
    }>(sql`
      SELECT
        e.patient_id,
        patients.label AS patient_label,
        e.metadata->>'product' AS product,
        e.occurred_at
      FROM patient_events e
      JOIN patients ON patients.id = e.patient_id
      WHERE e.kind = 'trial_start'
        AND patients.status <> 'lost'
        AND e.occurred_at < now() - interval '14 days'
        AND NOT EXISTS (
          SELECT 1 FROM patient_events d
          WHERE d.patient_id = e.patient_id
            AND d.kind = 'delivery'
            AND d.occurred_at >= e.occurred_at
        )
        AND ${patientLocaleFilter}
      ORDER BY e.occurred_at ASC
      LIMIT 1
    `),
    db.execute<{
      session_id: string;
      patient_id: string;
      patient_label: string;
      global_score: number | null;
      analyzed_at: string;
    }>(sql`
      SELECT
        s.id AS session_id,
        s.patient_id,
        p.label AS patient_label,
        s.global_score,
        s.analyzed_at
      FROM sessions s
      JOIN patients p ON p.id = s.patient_id
      WHERE s.kind = 'consultation'
        AND s.analysis_status = 'done'
        AND s.analyzed_at IS NOT NULL
        AND s.analyzed_at <= now() - interval '3 days'
        AND s.analyzed_at >= now() - interval '7 days'
        AND p.status = 'prospect'
        AND COALESCE(s.metadata->>'locale', 'fr') = ${locale}
      ORDER BY s.analyzed_at DESC
      LIMIT 1
    `),
    db.execute<{
      session_id: string;
      patient_label: string;
      global_score: number;
      analyzed_at: string;
    }>(sql`
      SELECT
        s.id AS session_id,
        p.label AS patient_label,
        s.global_score,
        s.analyzed_at
      FROM sessions s
      JOIN patients p ON p.id = s.patient_id
      WHERE s.kind = 'consultation'
        AND s.analysis_status = 'done'
        AND s.global_score IS NOT NULL
        AND s.global_score < 50
        AND s.analyzed_at IS NOT NULL
        AND s.analyzed_at >= now() - interval '7 days'
        AND COALESCE(s.metadata->>'locale', 'fr') = ${locale}
      ORDER BY s.analyzed_at DESC
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

  const trialRow = trialInProgressRow[0];
  const trialInProgress = trialRow
    ? {
        patientId: trialRow.patient_id,
        patientLabel: trialRow.patient_label,
        product: trialRow.product,
        daysSinceTrial: Math.max(
          1,
          Math.round(
            (Date.now() - new Date(trialRow.occurred_at).getTime()) /
              86_400_000
          )
        ),
      }
    : null;

  const followUpRow = prospectFollowUpRow[0];
  const prospectToFollowUp = followUpRow
    ? {
        sessionId: followUpRow.session_id,
        patientId: followUpRow.patient_id,
        patientLabel: followUpRow.patient_label,
        score: followUpRow.global_score,
        daysSinceConsult: Math.max(
          1,
          Math.round(
            (Date.now() - new Date(followUpRow.analyzed_at).getTime()) /
              86_400_000
          )
        ),
      }
    : null;

  const lowScore = lowScoreRow[0];
  const lowScoreToDebrief = lowScore
    ? {
        sessionId: lowScore.session_id,
        patientLabel: lowScore.patient_label,
        score: lowScore.global_score,
        daysAgo: Math.max(
          0,
          Math.round(
            (Date.now() - new Date(lowScore.analyzed_at).getTime()) /
              86_400_000
          )
        ),
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
    trialInProgress,
    prospectToFollowUp,
    lowScoreToDebrief,
  };
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 100)} %`;
}

type DashTrans = (key: string, params?: Record<string, string | number>) => string;

function buildPractitionerKpis(
  ctx: DashboardContext,
  locale: Locale,
  t: DashTrans
): DashboardKpi[] {
  const fittedDen = ctx.consultationsCount > 0 ? ctx.consultationsCount : 0;
  const den = fittedDen || ctx.totalPatients;
  return [
    {
      kind: "conversion",
      label: t("kpiPractitionerConversion"),
      value: pct(ctx.fittedPatients, den),
      hint: t("kpiPractitionerConversionHint", {
        fitted: ctx.fittedPatients,
        total: den,
      }),
    },
    {
      kind: "basket",
      label: t("kpiPractitionerBasket"),
      value:
        ctx.basketAvgEur != null ? eurFormat(locale, ctx.basketAvgEur) : "—",
      hint: t("kpiPractitionerBasketHint"),
    },
    {
      kind: "score",
      label: t("kpiPractitionerScore"),
      value:
        ctx.practitionerAvgScore != null
          ? `${ctx.practitionerAvgScore}/100`
          : "—",
      hint: ctx.lastConsultation?.patientLabel
        ? t("kpiPractitionerScoreHintLast", {
            label: ctx.lastConsultation.patientLabel,
          })
        : t("kpiPractitionerScoreHintGeneric"),
    },
  ];
}

function buildAssistantKpis(
  ctx: DashboardContext,
  _locale: Locale,
  t: DashTrans
): DashboardKpi[] {
  const dur = ctx.callDurationAvgSec;
  return [
    {
      kind: "callDuration",
      label: t("kpiAssistantDuration"),
      value:
        dur != null
          ? `${Math.floor(dur / 60)}m ${(dur % 60).toString().padStart(2, "0")}s`
          : "—",
      hint: t("kpiAssistantDurationHint"),
    },
    {
      kind: "callScore",
      label: t("kpiAssistantScore"),
      value:
        ctx.assistantAvgScore != null
          ? `${ctx.assistantAvgScore}/100`
          : "—",
      hint: t("kpiAssistantScoreHint"),
    },
  ];
}

async function loadWeeklyScores(
  kind: FrameworkKind,
  locale: Locale,
  t: DashTrans
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
      AND COALESCE(metadata->>'locale', 'fr') = ${locale}
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
      weekLabel: i === 0 ? t("weekThis") : t("weekShort", { n: i }),
      consultations: hit?.count ?? 0,
      avgScore: hit?.avg ?? null,
    });
  }
  return points;
}

async function loadHeatmap(
  kind: FrameworkKind,
  locale: Locale
): Promise<StepHeatmapCell[]> {
  const framework = getScorableFramework(kind);
  const scorableNumbers = framework.map((s) => s.number);

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
      AND COALESCE(s.metadata->>'locale', 'fr') = ${locale}
      AND ss.step_number IN (${sql.join(
        scorableNumbers.map((n) => sql`${n}`),
        sql`, `
      )})
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
      name: getStepName(step, locale),
      avgScore: hit?.avg ?? null,
      coverageRatio: hit && hit.total > 0 ? hit.coverage / hit.total : 0,
    };
  });
}

