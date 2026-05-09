import "server-only";
import { asc, desc, inArray } from "drizzle-orm";
import pLimit from "p-limit";
import { db } from "@/db/client";
import {
  centers,
  coachingInsights,
  patientEvents,
  patients,
  sessions,
} from "@/db/schema";
import { PSY_AXES, type PsyAxis, type PsyRadar } from "../axes";
import { hasActiveMarketingConsent } from "../consent";
import { getPatientSnapshots } from "../queries";
import { computeGlobalRadar, computeGlobalTags, findSnapshotForAxis } from "../aggregate";
import { PSY_TAG_LABEL, PSY_TAG_LABEL_EN } from "../tags";
import { combineUrgency, computeUrgencyBase } from "./urgency";
import { generateRecommendation } from "./recommendation";
import type {
  ConsentMode,
  ExportInsightRow,
  ExportLocale,
  ExportPayload,
  ExportSessionRow,
  ExportTimelineRow,
  PatientEventKind,
  PatientExportRecord,
  PatientStatus,
  TopInsight,
} from "./types";

const HAIKU_CONCURRENCY = 8;

export async function buildPatientExportData(opts: {
  ids: string[];
  consentMode: ConsentMode;
  locale: ExportLocale;
}): Promise<ExportPayload> {
  const { ids, consentMode, locale } = opts;

  if (ids.length === 0) {
    return emptyPayload(locale, consentMode);
  }

  // 1. Charger les patients + filtrage consentement
  const pats = await db.select().from(patients).where(inArray(patients.id, ids));
  const filtered = pats.filter(
    (p) => consentMode === "all" || hasActiveMarketingConsent(p)
  );
  const filteredIds = filtered.map((p) => p.id);
  if (filteredIds.length === 0) {
    return emptyPayload(locale, consentMode);
  }

  // 2. Charger en bulk : centres, sessions, events, insights
  const centerIds = Array.from(
    new Set(filtered.map((p) => p.centerId).filter((c): c is string => !!c))
  );
  const centersMap = new Map<string, string>();
  if (centerIds.length > 0) {
    const centerRows = await db
      .select({ id: centers.id, name: centers.name })
      .from(centers)
      .where(inArray(centers.id, centerIds));
    for (const c of centerRows) centersMap.set(c.id, c.name);
  }

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(inArray(sessions.patientId, filteredIds))
    .orderBy(asc(sessions.startedAt));

  const eventRows = await db
    .select()
    .from(patientEvents)
    .where(inArray(patientEvents.patientId, filteredIds))
    .orderBy(asc(patientEvents.occurredAt));

  const sessionIds = sessionRows.map((s) => s.id);
  const insightRows =
    sessionIds.length > 0
      ? await db
          .select()
          .from(coachingInsights)
          .where(inArray(coachingInsights.sessionId, sessionIds))
          .orderBy(desc(coachingInsights.estimatedImpactEur))
      : [];

  // 3. Indexer par patient
  const sessionsByPatient = groupBy(sessionRows, (s) => s.patientId ?? "");
  const eventsByPatient = groupBy(eventRows, (e) => e.patientId);
  const sessionToPatient = new Map<string, string>();
  for (const s of sessionRows) {
    if (s.patientId) sessionToPatient.set(s.id, s.patientId);
  }
  const insightsByPatient = new Map<string, typeof insightRows>();
  for (const ins of insightRows) {
    const pid = sessionToPatient.get(ins.sessionId);
    if (!pid) continue;
    const arr = insightsByPatient.get(pid) ?? [];
    arr.push(ins);
    insightsByPatient.set(pid, arr);
  }

  // 4. Pré-construire les records SANS la recommandation
  const now = Date.now();
  const records: Array<Omit<PatientExportRecord, "recommendation">> = [];

  for (const pat of filtered) {
    const snaps = await getPatientSnapshots(pat.id);
    const radar = computeGlobalRadar(snaps);
    const tags = computeGlobalTags(snaps);
    const tagsLabel = tags.map((t) =>
      locale === "en" ? PSY_TAG_LABEL_EN[t] : PSY_TAG_LABEL[t]
    );

    const psSessions = sessionsByPatient.get(pat.id) ?? [];
    const psEvents = eventsByPatient.get(pat.id) ?? [];
    const psInsights = insightsByPatient.get(pat.id) ?? [];

    const consultations = psSessions.filter((s) => s.kind === "consultation");
    const phoneCalls = psSessions.filter((s) => s.kind === "phone_call");
    const totalDurationSec = psSessions.reduce(
      (acc, s) => acc + (s.durationSeconds ?? 0),
      0
    );
    const scoredSessions = psSessions.filter(
      (s) => s.globalScore !== null && s.globalScore !== undefined
    );
    const avgScore =
      scoredSessions.length > 0
        ? Math.round(
            scoredSessions.reduce((a, s) => a + (s.globalScore ?? 0), 0) /
              scoredSessions.length
          )
        : null;
    const lastScored = [...scoredSessions].sort(
      (a, b) =>
        (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0)
    )[0];

    const lastEvent = psEvents[psEvents.length - 1];
    const firstContactAt = pat.firstContactAt ?? psEvents[0]?.occurredAt ?? null;
    const lastInteractionAt =
      lastEvent?.occurredAt ?? psSessions[psSessions.length - 1]?.startedAt ?? null;
    const stageStartedAt = lastEvent?.occurredAt ?? null;

    const radarDetail = buildRadarDetail(snaps, radar);

    const top: TopInsight[] = psInsights.slice(0, 3).map((ins) => {
      const sess = psSessions.find((s) => s.id === ins.sessionId);
      return {
        title: ins.title,
        estimated_impact_eur: ins.estimatedImpactEur,
        severity: (ins.severity ?? "info") as TopInsight["severity"],
        session_date: sess?.startedAt
          ? sess.startedAt.toISOString().slice(0, 10)
          : "",
      };
    });

    records.push({
      patient_id: pat.id,
      full_name: pat.label,
      age: pat.age,
      center_name: pat.centerId ? centersMap.get(pat.centerId) ?? null : null,
      marketing_consent_at: pat.marketingPsyConsentAt
        ? pat.marketingPsyConsentAt.toISOString()
        : null,

      status: pat.status as PatientStatus,
      current_stage: (lastEvent?.kind ?? null) as PatientEventKind | null,
      first_contact_at: firstContactAt ? firstContactAt.toISOString() : null,
      last_interaction_at: lastInteractionAt ? lastInteractionAt.toISOString() : null,
      days_in_pipeline: firstContactAt
        ? Math.floor((now - firstContactAt.getTime()) / 86_400_000)
        : null,
      days_in_current_stage: stageStartedAt
        ? Math.floor((now - stageStartedAt.getTime()) / 86_400_000)
        : null,

      total_sessions: psSessions.length,
      consultations_count: consultations.length,
      phone_calls_count: phoneCalls.length,
      total_duration_minutes: Math.round(totalDurationSec / 60),
      avg_session_score: avgScore,
      last_session_score: lastScored?.globalScore ?? null,

      tags,
      tags_label: tagsLabel,
      radar,
      radar_detail: radarDetail,

      opportunity: {
        total_estimated_eur: psInsights.reduce(
          (a, i) => a + (i.estimatedImpactEur ?? 0),
          0
        ),
        missed_objections_count: psInsights.filter(
          (i) => i.type === "missed_objection"
        ).length,
        upsell_missed_count: psInsights.filter((i) => i.type === "upsell_missed")
          .length,
        top_insights: top,
      },
    });
  }

  // 5. Recommandations Haiku — 1 appel par patient en parallèle, p-limit 8
  const limit = pLimit(HAIKU_CONCURRENCY);
  const finalRecords: PatientExportRecord[] = await Promise.all(
    records.map((rec) =>
      limit(async () => {
        const reco = await generateRecommendation(rec, locale);
        if (!reco) return { ...rec, recommendation: null };
        const base = computeUrgencyBase({
          radar: rec.radar,
          status: rec.status,
          tags: rec.tags,
          days_in_pipeline: rec.days_in_pipeline,
        });
        return {
          ...rec,
          recommendation: {
            ...reco.recommendation,
            urgency_score: combineUrgency(base, reco.urgencyBoost),
          },
        };
      })
    )
  );

  // 6. Aplatir sessions/insights/timeline pour XLSX
  const exportSessions: ExportSessionRow[] = sessionRows
    .filter((s) => s.patientId && filteredIds.includes(s.patientId))
    .map((s) => ({
      session_id: s.id,
      patient_id: s.patientId!,
      kind: (s.kind === "phone_call" ? "phone_call" : "consultation") as
        | "consultation"
        | "phone_call",
      started_at: s.startedAt ? s.startedAt.toISOString() : "",
      duration_seconds: s.durationSeconds,
      global_score: s.globalScore,
      summary: s.summary,
    }));

  const exportInsights: ExportInsightRow[] = insightRows.map((ins) => ({
    insight_id: ins.id,
    patient_id: sessionToPatient.get(ins.sessionId) ?? "",
    session_id: ins.sessionId,
    type: ins.type,
    severity: ins.severity as ExportInsightRow["severity"],
    title: ins.title,
    description: ins.description,
    estimated_impact_eur: ins.estimatedImpactEur,
  }));

  const exportTimeline: ExportTimelineRow[] = eventRows
    .filter((e) => filteredIds.includes(e.patientId))
    .map((e) => ({
      event_id: e.id,
      patient_id: e.patientId,
      kind: e.kind as ExportTimelineRow["kind"],
      occurred_at: e.occurredAt.toISOString(),
      summary: e.summary,
    }));

  return {
    exported_at: new Date().toISOString(),
    locale,
    consent_mode: consentMode,
    count: finalRecords.length,
    patients: finalRecords,
    sessions: exportSessions,
    insights: exportInsights,
    timeline: exportTimeline,
  };
}

function emptyPayload(locale: ExportLocale, consentMode: ConsentMode): ExportPayload {
  return {
    exported_at: new Date().toISOString(),
    locale,
    consent_mode: consentMode,
    count: 0,
    patients: [],
    sessions: [],
    insights: [],
    timeline: [],
  };
}

function buildRadarDetail(
  snapshots: Awaited<ReturnType<typeof getPatientSnapshots>>,
  radar: PsyRadar
): PatientExportRecord["radar_detail"] {
  const detail = {} as PatientExportRecord["radar_detail"];
  for (const axis of PSY_AXES) {
    const sourceSnap = findSnapshotForAxis(axis, snapshots);
    const score = radar[axis];
    const trend = computeAxisTrend(axis, snapshots);
    const raw =
      sourceSnap?.rawOutput && typeof sourceSnap.rawOutput === "object"
        ? (sourceSnap.rawOutput as { axes?: Record<string, { rationale?: string; citation?: string }> })
        : null;
    const axisRaw = raw?.axes?.[axis] ?? null;
    detail[axis] = {
      score,
      rationale: axisRaw?.rationale ?? null,
      verbatim: axisRaw?.citation ?? null,
      trend,
      source_session_id: sourceSnap?.sessionId ?? null,
    };
  }
  return detail;
}

function computeAxisTrend(
  axis: PsyAxis,
  snapshots: Awaited<ReturnType<typeof getPatientSnapshots>>
): "up" | "down" | "stable" | null {
  const ordered = [...snapshots].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const withVal = ordered.filter(
    (s) => s.radar[axis] !== null && s.radar[axis] !== undefined
  );
  if (withVal.length < 2) return null;
  const latest = withVal[0].radar[axis]!;
  const previous = withVal[1].radar[axis]!;
  const delta = latest - previous;
  if (Math.abs(delta) < 1) return "stable";
  return delta > 0 ? "up" : "down";
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const existing = m.get(k) ?? [];
    existing.push(item);
    m.set(k, existing);
  }
  return m;
}
