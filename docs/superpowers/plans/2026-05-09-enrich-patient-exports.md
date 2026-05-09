# Enrichissement des exports patients — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir l'export marketing des patients en ajoutant statut funnel, engagement, opportunité commerciale, profil psy détaillé, et recommandation IA — exposés sous 3 formats (CSV, XLSX, JSON) en FR/EN.

**Architecture:** Une route API unifiée `/api/exports/patients` produit `PatientExportRecord[]` via `buildPatientExportData()`, puis dispatch vers un formatter dédié selon `?format=`. La recommandation marketing est générée par un appel Haiku par patient en parallèle (limite 8 concurrents), avec fallback silencieux. UI : un seul composant dropdown `<ExportFormatMenu>` réutilisé sur la table patients (bulk) et la fiche patient (single).

**Tech Stack:**
- Next.js 16 App Router + React 19
- Drizzle ORM + Postgres (existant)
- `@anthropic-ai/sdk` (existant) — Haiku pour reco
- **Nouvelles deps** : `exceljs` (XLSX multi-feuilles + styling), `p-limit` (concurrence Haiku)
- `next-intl` (existant) pour locale UI

**Spec source:** [docs/superpowers/specs/2026-05-09-enrich-patient-exports-design.md](../specs/2026-05-09-enrich-patient-exports-design.md)

**Tests strategy:** Le projet n'a pas d'infra de tests automatisés. On suit la convention du projet : **typecheck + lint + scripts de smoke manuels** (cf. `scripts/test-j8-pipeline.ts`, `scripts/psy-score-session.ts`). Chaque tâche se termine par `pnpm typecheck && pnpm lint`.

---

## File Structure

**Création :**
```
lib/psychology/export/
├── types.ts              # PatientExportRecord + types dérivés
├── urgency.ts            # computeUrgencyBase() — formule déterministe
├── recommendation.ts     # generateRecommendation() — appel Haiku par patient
├── build.ts              # buildPatientExportData() — agrège tout
├── format-csv.ts         # ⬅ déplacé depuis lib/psychology/format-csv.ts + enrichi
├── format-json.ts        # nouveau
└── format-xlsx.ts        # nouveau (exceljs)

app/api/exports/patients/route.ts              # nouvelle route unifiée
components/exports/export-format-menu.tsx      # composant dropdown réutilisable
scripts/smoke-export.ts                        # smoke test manuel via tsx
```

**Modification :**
```
app/admin/psychology/export/route.ts           # devient alias 307
components/patients/patients-table.tsx         # remplace bouton CSV par dropdown
components/patients/marketing-consent-toggle.tsx  # idem
```

**Suppression :**
```
lib/psychology/format-csv.ts                   # remplacé par lib/psychology/export/format-csv.ts
```

---

## Task 0 — Setup dépendances

**Files:**
- Modify: `package.json` (via pnpm add)

- [ ] **Step 1: Installer les nouvelles dépendances**

Run:
```bash
pnpm add exceljs p-limit
```

- [ ] **Step 2: Vérifier l'install**

Run:
```bash
pnpm typecheck
```
Expected: 0 erreur. (Aucun import ajouté pour le moment, juste les deps présentes.)

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add exceljs and p-limit for export pipeline"
```

---

## Task 1 — Types partagés `lib/psychology/export/types.ts`

**Files:**
- Create: `lib/psychology/export/types.ts`

- [ ] **Step 1: Créer le fichier de types**

```typescript
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
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck
```
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/psychology/export/types.ts
git commit -m "feat(export): add PatientExportRecord types"
```

---

## Task 2 — Formule urgency déterministe `lib/psychology/export/urgency.ts`

**Files:**
- Create: `lib/psychology/export/urgency.ts`

- [ ] **Step 1: Implémenter `computeUrgencyBase`**

```typescript
import type { PatientExportRecord } from "./types";

/**
 * Composante déterministe de l'urgence (0–85). La composante LLM (boost ±15)
 * est ajoutée par-dessus dans build.ts. Toute la logique est documentable
 * pour Amplifon — c'est le 70% reproductible du score 70/30.
 */
export function computeUrgencyBase(
  record: Pick<PatientExportRecord, "radar" | "status" | "tags" | "days_in_pipeline">
): number {
  if (record.status === "lost") return 0;

  let s = 0;
  const r = record.radar;

  // Avancement de la décision (0..30)
  if (r.decisionStage !== null) {
    if (r.decisionStage >= 7) s += 30;
    else if (r.decisionStage >= 5) s += 15;
  }

  // Motivation (0..20)
  if (r.motivation !== null) {
    if (r.motivation >= 7) s += 20;
    else if (r.motivation >= 5) s += 10;
  }

  // Confiance basse → urgence à rassurer (0..10)
  if (r.trust !== null && r.trust <= 4) s += 10;

  // Pipeline qui traîne (0..15)
  if (
    record.status === "prospect" &&
    record.days_in_pipeline !== null &&
    record.days_in_pipeline > 30
  ) {
    s += 15;
  }

  // Bonus tag prospect-chaud (0..10)
  if (record.tags.includes("prospect-chaud")) s += 10;

  return Math.min(85, s);
}

/**
 * Combine la base déterministe avec le boost LLM (±15) et clamp 0..100.
 */
export function combineUrgency(base: number, boost: number): number {
  const safeBoost = Math.max(-15, Math.min(15, Math.round(boost)));
  return Math.max(0, Math.min(100, base + safeBoost));
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck && pnpm lint lib/psychology/export/
```
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Commit**

```bash
git add lib/psychology/export/urgency.ts
git commit -m "feat(export): deterministic urgency score formula"
```

---

## Task 3 — Recommandation IA `lib/psychology/export/recommendation.ts`

**Files:**
- Create: `lib/psychology/export/recommendation.ts`

- [ ] **Step 1: Implémenter le prompt + appel Haiku**

```typescript
import "server-only";
import { getAnthropic, CLAUDE_MODELS } from "@/lib/claude";
import type {
  PatientExportRecord,
  Recommendation,
  ExportLocale,
} from "./types";

const VALID_SEGMENTS = ["hot", "warm", "cold", "lost"] as const;
const VALID_CHANNELS = [
  "phone",
  "email",
  "sms",
  "in_person",
  "no_touch",
] as const;

type RawReco = {
  priority_segment?: string;
  urgency_boost?: number;
  recommended_channel?: string;
  recommended_angle?: string;
  next_best_action?: string;
};

/**
 * Génère une recommandation marketing pour un patient via Haiku.
 * Renvoie null si Haiku timeout, JSON invalide, ou champs manquants
 * (l'export ne plante jamais). `urgency_boost` est retourné séparément
 * et combiné dans build.ts via combineUrgency().
 */
export async function generateRecommendation(
  record: Omit<PatientExportRecord, "recommendation">,
  locale: ExportLocale
): Promise<{ recommendation: Recommendation; urgencyBoost: number } | null> {
  const prompt = buildPrompt(record, locale);

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.haiku,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const cleaned = stripFence(textBlock.text);
    const parsed = JSON.parse(cleaned) as RawReco;

    return validateAndBuild(parsed);
  } catch (err) {
    console.warn(
      `[export/recommendation] Haiku failed for patient=${record.patient_id}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

function buildPrompt(
  record: Omit<PatientExportRecord, "recommendation">,
  locale: ExportLocale
): string {
  const langInstruction =
    locale === "en"
      ? "Respond in English. The recommended_angle and next_best_action MUST be in English."
      : "Réponds en français. Les champs recommended_angle et next_best_action DOIVENT être en français.";

  const profile = {
    age: record.age,
    status: record.status,
    current_stage: record.current_stage,
    days_in_pipeline: record.days_in_pipeline,
    total_sessions: record.total_sessions,
    avg_session_score: record.avg_session_score,
    radar: record.radar,
    tags: record.tags,
    opportunity: {
      total_eur: record.opportunity.total_estimated_eur,
      top_insights: record.opportunity.top_insights.map((i) => ({
        title: i.title,
        eur: i.estimated_impact_eur,
        severity: i.severity,
      })),
    },
  };

  return `Tu es un assistant marketing pour un réseau d'audioprothèse. À partir du profil suivant, produis une recommandation actionnable.

PROFIL PATIENT :
${JSON.stringify(profile, null, 2)}

INSTRUCTIONS :
- ${langInstruction}
- recommended_angle : 4-8 mots décrivant l'angle de relance (ex: "Rassurance technique + démonstration sociale")
- next_best_action : UNE phrase impérative et concrète (max 25 mots), avec délai si pertinent
- urgency_boost : entier entre -15 et +15 reflétant l'urgence contextuelle (top_insights critiques → +5..+15, patient lost → -10..-15)
- priority_segment : "hot" si decision_stage>=7 ET motivation>=7 ; "lost" si status=lost ; "cold" si decision_stage<=3 ; sinon "warm"
- recommended_channel : "phone" pour relance urgente, "email" pour éducation, "sms" pour rappel court, "in_person" pour démo, "no_touch" pour patients perdus

OUTPUT — JSON STRICT, AUCUN AUTRE TEXTE :
{
  "priority_segment": "hot|warm|cold|lost",
  "urgency_boost": -15 à 15,
  "recommended_channel": "phone|email|sms|in_person|no_touch",
  "recommended_angle": "...",
  "next_best_action": "..."
}`;
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```[a-zA-Z0-9]*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }
  return trimmed;
}

function validateAndBuild(
  raw: RawReco
): { recommendation: Recommendation; urgencyBoost: number } | null {
  const segment = raw.priority_segment;
  const channel = raw.recommended_channel;

  if (!segment || !VALID_SEGMENTS.includes(segment as (typeof VALID_SEGMENTS)[number])) {
    return null;
  }
  if (!channel || !VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
    return null;
  }
  if (typeof raw.recommended_angle !== "string" || !raw.recommended_angle.trim()) {
    return null;
  }
  if (typeof raw.next_best_action !== "string" || !raw.next_best_action.trim()) {
    return null;
  }

  const boost =
    typeof raw.urgency_boost === "number" && Number.isFinite(raw.urgency_boost)
      ? raw.urgency_boost
      : 0;

  return {
    recommendation: {
      priority_segment: segment as Recommendation["priority_segment"],
      urgency_score: 0, // sera défini dans build.ts via combineUrgency
      recommended_channel: channel as Recommendation["recommended_channel"],
      recommended_angle: raw.recommended_angle.trim(),
      next_best_action: raw.next_best_action.trim(),
    },
    urgencyBoost: boost,
  };
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck && pnpm lint lib/psychology/export/
```
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Commit**

```bash
git add lib/psychology/export/recommendation.ts
git commit -m "feat(export): Haiku-powered marketing recommendation per patient"
```

---

## Task 4 — Agrégateur central `lib/psychology/export/build.ts`

**Files:**
- Create: `lib/psychology/export/build.ts`

- [ ] **Step 1: Implémenter `buildPatientExportData`**

```typescript
import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
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
      current_stage: lastEvent?.kind ?? null,
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
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck
```
Expected: 0 erreur. Si Drizzle se plaint d'un type, vérifier les noms de colonnes contre `db/schema.ts`.

- [ ] **Step 3: Lint**

Run:
```bash
pnpm lint lib/psychology/export/
```
Expected: 0 warning.

- [ ] **Step 4: Commit**

```bash
git add lib/psychology/export/build.ts
git commit -m "feat(export): buildPatientExportData aggregates funnel/engagement/opportunity/reco"
```

---

## Task 5 — Formatter CSV `lib/psychology/export/format-csv.ts`

**Files:**
- Create: `lib/psychology/export/format-csv.ts`
- Delete (after Task 9): `lib/psychology/format-csv.ts` (l'ancien)

- [ ] **Step 1: Créer le nouveau formatter CSV enrichi**

```typescript
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
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck
```
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/psychology/export/format-csv.ts
git commit -m "feat(export): enriched CSV formatter (~50 columns)"
```

---

## Task 6 — Formatter JSON `lib/psychology/export/format-json.ts`

**Files:**
- Create: `lib/psychology/export/format-json.ts`

- [ ] **Step 1: Implémenter**

```typescript
import type { ExportPayload } from "./types";

/**
 * Sérialise le payload complet en JSON arborescent indenté.
 * Ne ré-encode pas — `buildPatientExportData` produit déjà des dates ISO et
 * des structures sérialisables.
 */
export function formatJson(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck
```
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/psychology/export/format-json.ts
git commit -m "feat(export): JSON formatter"
```

---

## Task 7 — Formatter XLSX `lib/psychology/export/format-xlsx.ts`

**Files:**
- Create: `lib/psychology/export/format-xlsx.ts`

- [ ] **Step 1: Implémenter le formatter multi-feuilles**

```typescript
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
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck
```
Expected: 0 erreur.

- [ ] **Step 3: Lint**

Run:
```bash
pnpm lint lib/psychology/export/
```
Expected: 0 warning.

- [ ] **Step 4: Commit**

```bash
git add lib/psychology/export/format-xlsx.ts
git commit -m "feat(export): XLSX formatter with 4 styled sheets"
```

---

## Task 8 — Route API unifiée `app/api/exports/patients/route.ts`

**Files:**
- Create: `app/api/exports/patients/route.ts`

- [ ] **Step 1: Créer le handler**

```typescript
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { buildPatientExportData } from "@/lib/psychology/export/build";
import { formatCsv } from "@/lib/psychology/export/format-csv";
import { formatJson } from "@/lib/psychology/export/format-json";
import { formatXlsx } from "@/lib/psychology/export/format-xlsx";
import type {
  ConsentMode,
  ExportFormat,
  ExportLocale,
} from "@/lib/psychology/export/types";

const VALID_FORMATS: ExportFormat[] = ["csv", "xlsx", "json"];
const VALID_LOCALES: ExportLocale[] = ["fr", "en"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  const formatParam = (params.get("format") ?? "csv") as ExportFormat;
  if (!VALID_FORMATS.includes(formatParam)) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  const localeParam = (params.get("locale") ?? "fr") as ExportLocale;
  if (!VALID_LOCALES.includes(localeParam)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const consentMode: ConsentMode =
    params.get("consent") === "all" ? "all" : "active";

  const payload = await buildPatientExportData({
    ids,
    consentMode,
    locale: localeParam,
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const baseName = `clinic-os-patients-${dateStr}`;

  if (formatParam === "csv") {
    const csv = formatCsv(payload);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  if (formatParam === "json") {
    const json = formatJson(payload);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.json"`,
      },
    });
  }

  // xlsx
  const buffer = await formatXlsx(payload);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
    },
  });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
pnpm typecheck
```
Expected: 0 erreur.

- [ ] **Step 3: Démarrer le dev server et tester chaque format manuellement**

Run :
```bash
pnpm dev
```

Puis dans un autre terminal, identifier 1 patient seedé avec consentement actif :
```bash
curl -s "http://localhost:3000/api/exports/patients?ids=<UUID>&format=csv&locale=fr" | head -2
```
Expected: 1ère ligne = headers, 2ème = données du patient.

```bash
curl -s "http://localhost:3000/api/exports/patients?ids=<UUID>&format=json&locale=en" | head -30
```
Expected: JSON valide commençant par `{ "exported_at": "...", "locale": "en", ... }`.

```bash
curl -s "http://localhost:3000/api/exports/patients?ids=<UUID>&format=xlsx" -o /tmp/clinic-export.xlsx
file /tmp/clinic-export.xlsx
```
Expected: `Microsoft Excel 2007+`.

- [ ] **Step 4: Commit**

```bash
git add app/api/exports/patients/route.ts
git commit -m "feat(export): unified /api/exports/patients route (csv/json/xlsx)"
```

---

## Task 9 — Migration de l'ancienne route + suppression de `lib/psychology/format-csv.ts`

**Files:**
- Modify: `app/admin/psychology/export/route.ts`
- Delete: `lib/psychology/format-csv.ts`

- [ ] **Step 1: Remplacer le contenu de l'ancienne route par un alias 307**

Overwrite `app/admin/psychology/export/route.ts` avec :

```typescript
import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * Alias vers la nouvelle route unifiée.
 * Préserve les liens existants pendant la transition.
 * À supprimer dans une PR ultérieure si plus aucun appelant.
 */
export async function GET(req: NextRequest) {
  const target = new URL("/api/exports/patients", req.url);
  // Forward tous les params + ajoute format=csv par défaut
  req.nextUrl.searchParams.forEach((v, k) => {
    target.searchParams.set(k, v);
  });
  if (!target.searchParams.has("format")) {
    target.searchParams.set("format", "csv");
  }
  return NextResponse.redirect(target, 307);
}
```

- [ ] **Step 2: Supprimer l'ancien `lib/psychology/format-csv.ts`**

Run:
```bash
rm lib/psychology/format-csv.ts
```

- [ ] **Step 3: Vérifier qu'aucun import ne pointe encore vers l'ancien chemin**

Run:
```bash
grep -rn 'lib/psychology/format-csv' --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next"
```
Expected: 0 résultat.

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
pnpm typecheck && pnpm lint
```
Expected: 0 erreur, 0 warning.

- [ ] **Step 5: Smoke test l'alias**

Avec le dev server tournant :
```bash
curl -s -i "http://localhost:3000/admin/psychology/export?ids=<UUID>&consent=active" | head -5
```
Expected: `HTTP/1.1 307 Temporary Redirect` + header `location: /api/exports/patients?ids=...&consent=active&format=csv`

- [ ] **Step 6: Commit**

```bash
git add app/admin/psychology/export/route.ts lib/psychology/format-csv.ts
git commit -m "refactor(export): alias old psychology export route to /api/exports/patients"
```

---

## Task 10 — Composant dropdown `<ExportFormatMenu>`

**Files:**
- Create: `components/exports/export-format-menu.tsx`

- [ ] **Step 1: Implémenter le composant**

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import type { ExportFormat, ExportLocale } from "@/lib/psychology/export/types";

type Props = {
  /** Compte affiché dans le bouton (ex: "Exporter (12)"). */
  exportableCount: number;
  /** Construit l'URL pour un (format, locale) donné. */
  buildUrl: (format: ExportFormat, locale: ExportLocale) => string;
  /** Désactive le bouton avec un tooltip si fourni. */
  disabled?: boolean;
  disabledTooltip?: string;
  /** Variante compacte (sans le compte) pour la fiche patient. */
  compact?: boolean;
};

const FORMAT_LABEL_FR: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (.xlsx)",
  json: "JSON",
};

const FORMAT_LABEL_EN: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (.xlsx)",
  json: "JSON",
};

const FORMAT_HINT_FR: Record<ExportFormat, string> = {
  csv: "Universel — CRM, marketing automation",
  xlsx: "4 feuilles colorées — équipe marketing",
  json: "Arborescent — intégration API / Zapier",
};

const FORMAT_HINT_EN: Record<ExportFormat, string> = {
  csv: "Universal — CRM, marketing automation",
  xlsx: "4 styled sheets — marketing team",
  json: "Tree-shaped — API / Zapier integration",
};

export function ExportFormatMenu({
  exportableCount,
  buildUrl,
  disabled,
  disabledTooltip,
  compact,
}: Props) {
  const uiLocale = useLocale();
  const defaultLocale: ExportLocale = uiLocale === "en" ? "en" : "fr";
  const [open, setOpen] = useState(false);
  const [chosenLocale, setChosenLocale] = useState<ExportLocale>(defaultLocale);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const labels = uiLocale === "en" ? FORMAT_LABEL_EN : FORMAT_LABEL_FR;
  const hints = uiLocale === "en" ? FORMAT_HINT_EN : FORMAT_HINT_FR;

  const buttonText = compact
    ? uiLocale === "en"
      ? "Export"
      : "Exporter"
    : `${uiLocale === "en" ? "Export" : "Exporter"}${exportableCount > 0 ? ` (${exportableCount})` : ""}`;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? disabledTooltip : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download className="h-3.5 w-3.5" />
        {buttonText}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && !disabled && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-border bg-white shadow-lg">
          <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            {uiLocale === "en" ? "Format" : "Format"}
          </div>
          {(["csv", "xlsx", "json"] as ExportFormat[]).map((fmt) => (
            <a
              key={fmt}
              href={buildUrl(fmt, chosenLocale)}
              download
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm transition hover:bg-surface-muted"
            >
              <div className="font-medium">{labels[fmt]}</div>
              <div className="text-xs text-muted-foreground">{hints[fmt]}</div>
            </a>
          ))}

          <div className="border-t border-border px-3 py-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {uiLocale === "en" ? "Language" : "Langue"}
            </div>
            <div className="flex gap-2">
              {(["fr", "en"] as ExportLocale[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setChosenLocale(l)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs font-medium " +
                    (chosenLocale === l
                      ? "border-foreground bg-foreground text-white"
                      : "border-border bg-surface text-foreground hover:bg-surface-muted")
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
pnpm typecheck && pnpm lint components/exports/
```
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Commit**

```bash
git add components/exports/export-format-menu.tsx
git commit -m "feat(export): ExportFormatMenu dropdown component (csv/xlsx/json + fr/en)"
```

---

## Task 11 — Intégration dans `patients-table.tsx` (bulk)

**Files:**
- Modify: `components/patients/patients-table.tsx`

- [ ] **Step 1: Localiser la fonction qui construit l'URL d'export bulk**

Run:
```bash
grep -n "psychology/export" components/patients/patients-table.tsx
```
Note la ligne (~201) qui construit l'URL. Lire ~30 lignes autour pour comprendre le bouton actuel.

- [ ] **Step 2: Remplacer le bouton "Exporter CSV" par `<ExportFormatMenu>`**

Dans `components/patients/patients-table.tsx` :

1. Ajouter en haut du fichier l'import :
```typescript
import { ExportFormatMenu } from "@/components/exports/export-format-menu";
import type { ExportFormat, ExportLocale } from "@/lib/psychology/export/types";
```

2. Remplacer la fonction qui construit l'URL CSV par une fonction paramétrée. Repérer le bloc qui contient :
```typescript
const url = new URL("/admin/psychology/export", window.location.origin);
```
et l'extraire dans un callback `buildExportUrl(format, locale)` qui pointe vers `/api/exports/patients` :

```typescript
const buildExportUrl = (format: ExportFormat, locale: ExportLocale): string => {
  const url = new URL("/api/exports/patients", window.location.origin);
  // Récupère les ids exportables (sélection ou tous filtrés)
  const ids = exportableIds; // doit déjà exister dans le composant — sinon le réutiliser depuis la logique existante
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("consent", "active");
  url.searchParams.set("format", format);
  url.searchParams.set("locale", locale);
  return url.toString();
};
```

3. Remplacer le `<a>` ou `<button>` qui affiche "Exporter CSV ({exportableCount})" par :

```typescript
<ExportFormatMenu
  exportableCount={exportableCount}
  buildUrl={buildExportUrl}
  disabled={exportableCount === 0}
  disabledTooltip={
    locale === "en"
      ? "No selected/filtered patients with active consent"
      : "Aucun patient sélectionné/filtré avec consentement actif"
  }
/>
```

- [ ] **Step 3: Typecheck + lint**

Run:
```bash
pnpm typecheck && pnpm lint components/patients/
```
Expected: 0 erreur, 0 warning.

- [ ] **Step 4: Smoke test UI**

1. `pnpm dev`
2. Ouvrir `http://localhost:3000/patients`
3. Sélectionner 2-3 patients avec consentement actif
4. Cliquer le dropdown "Exporter (N)"
5. Vérifier : 3 formats listés (CSV / Excel / JSON), sélecteur FR/EN visible
6. Cliquer CSV → fichier téléchargé, ouvrir, vérifier ~50 colonnes + ligne par patient
7. Cliquer XLSX → ouvrir dans LibreOffice/Excel, vérifier 4 feuilles colorées
8. Cliquer JSON → ouvrir dans le navigateur, vérifier l'arborescence

- [ ] **Step 5: Commit**

```bash
git add components/patients/patients-table.tsx
git commit -m "feat(export): integrate ExportFormatMenu in patients table (bulk)"
```

---

## Task 12 — Intégration dans `marketing-consent-toggle.tsx` (single)

**Files:**
- Modify: `components/patients/marketing-consent-toggle.tsx`

- [ ] **Step 1: Remplacer le `<a href="/admin/psychology/export?ids=...">` par `<ExportFormatMenu>`**

Localiser le bloc actuel (lignes ~68-78 dans le fichier existant) :
```typescript
{active && (
  <a href={`/admin/psychology/export?ids=${patientId}&consent=active`} download ...>
    <Download className="h-3.5 w-3.5" />
    {t("exportProfile")}
  </a>
)}
```

Remplacer par :

```typescript
{active && (
  <ExportFormatMenu
    exportableCount={1}
    compact
    buildUrl={(format, locale) => {
      const url = new URL("/api/exports/patients", window.location.origin);
      url.searchParams.set("ids", patientId);
      url.searchParams.set("consent", "active");
      url.searchParams.set("format", format);
      url.searchParams.set("locale", locale);
      return url.toString();
    }}
  />
)}
```

Et ajouter en haut du fichier :
```typescript
import { ExportFormatMenu } from "@/components/exports/export-format-menu";
```

Retirer l'import `Download` du `lucide-react` s'il n'est plus utilisé ailleurs dans le fichier (sinon le laisser).

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
pnpm typecheck && pnpm lint components/patients/marketing-consent-toggle.tsx
```
Expected: 0 erreur, 0 warning.

- [ ] **Step 3: Smoke test UI**

1. `pnpm dev`
2. Ouvrir `http://localhost:3000/patients/<UUID>` (un patient avec consentement actif)
3. Vérifier que le bouton "Exporter ▾" apparaît à côté du toggle consentement
4. Cliquer → 3 formats + sélecteur langue
5. Choisir XLSX en EN → vérifier que le fichier s'ouvre en EN (textes des recommandations en anglais)

- [ ] **Step 4: Commit**

```bash
git add components/patients/marketing-consent-toggle.tsx
git commit -m "feat(export): integrate ExportFormatMenu in single-patient consent toggle"
```

---

## Task 13 — Smoke script + walkthrough final

**Files:**
- Create: `scripts/smoke-export.ts`

- [ ] **Step 1: Créer le script de smoke**

```typescript
import "dotenv/config";
import { db } from "@/db/client";
import { patients } from "@/db/schema";
import { hasActiveMarketingConsent } from "@/lib/psychology/consent";
import { buildPatientExportData } from "@/lib/psychology/export/build";
import { formatCsv } from "@/lib/psychology/export/format-csv";
import { formatJson } from "@/lib/psychology/export/format-json";
import { formatXlsx } from "@/lib/psychology/export/format-xlsx";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const allPatients = await db.select().from(patients);
  const eligible = allPatients.filter(hasActiveMarketingConsent);
  const ids = eligible.slice(0, 3).map((p) => p.id);

  if (ids.length === 0) {
    console.error("Aucun patient avec consentement actif. Lance d'abord les seeds.");
    process.exit(1);
  }

  console.log(`Smoke export sur ${ids.length} patients :`, ids);

  for (const locale of ["fr", "en"] as const) {
    const payload = await buildPatientExportData({
      ids,
      consentMode: "active",
      locale,
    });

    console.log(`\n=== Locale ${locale} ===`);
    console.log("count:", payload.count);
    console.log("sessions:", payload.sessions.length);
    console.log("insights:", payload.insights.length);
    console.log("timeline:", payload.timeline.length);
    console.log("recommendations OK:", payload.patients.filter((p) => p.recommendation !== null).length, "/", payload.patients.length);

    if (payload.patients[0]) {
      const p = payload.patients[0];
      console.log("Sample patient:");
      console.log("  full_name:", p.full_name);
      console.log("  status:", p.status, "/ stage:", p.current_stage);
      console.log("  tags:", p.tags.join(", "));
      console.log("  opportunity €:", p.opportunity.total_estimated_eur);
      if (p.recommendation) {
        console.log("  reco segment:", p.recommendation.priority_segment);
        console.log("  reco urgency:", p.recommendation.urgency_score);
        console.log("  reco angle:", p.recommendation.recommended_angle);
        console.log("  reco action:", p.recommendation.next_best_action);
      }
    }

    const outDir = "/tmp";
    writeFileSync(join(outDir, `smoke-export-${locale}.csv`), formatCsv(payload));
    writeFileSync(join(outDir, `smoke-export-${locale}.json`), formatJson(payload));
    writeFileSync(join(outDir, `smoke-export-${locale}.xlsx`), await formatXlsx(payload));
    console.log(`  → /tmp/smoke-export-${locale}.{csv,json,xlsx}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Ajouter le script dans package.json**

Modifier `package.json`, ajouter dans `"scripts"` :
```json
"smoke:export": "tsx --conditions react-server scripts/smoke-export.ts"
```

- [ ] **Step 3: Lancer le script**

Run:
```bash
pnpm smoke:export
```
Expected:
- Console montre les 3 patients en FR puis en EN
- Pour chaque patient : tags, urgency, segment, angle, next_best_action
- 6 fichiers générés dans `/tmp/` (csv/json/xlsx × fr/en)
- Toutes les recommandations doivent être non-null si l'API Anthropic répond

- [ ] **Step 4: Inspection manuelle des outputs**

```bash
head -2 /tmp/smoke-export-fr.csv
file /tmp/smoke-export-fr.xlsx
python3 -c "import json; d=json.load(open('/tmp/smoke-export-en.json')); print('count:', d['count'], 'first reco:', d['patients'][0]['recommendation'])"
```
Expected:
- CSV : header avec ~50 colonnes, ligne 2 = données
- XLSX : `Microsoft Excel 2007+`
- JSON : `count` numérique + reco non null

- [ ] **Step 5: Vérifier la qualité des `next_best_action` sur les 3 patients démo**

Ouvrir `/tmp/smoke-export-fr.json` et lire les 3 `next_best_action`. **Critère wow** : chaque phrase est claire, actionnable, contient un délai ou un canal, et n'est pas générique. Si une phrase est plate, ajuster le prompt dans `lib/psychology/export/recommendation.ts` (ex: ajouter un exemple FEW_SHOT au prompt) et relancer.

- [ ] **Step 6: Typecheck + lint final**

Run:
```bash
pnpm typecheck && pnpm lint
```
Expected: 0 erreur, 0 warning sur l'ensemble du projet.

- [ ] **Step 7: Commit**

```bash
git add scripts/smoke-export.ts package.json
git commit -m "chore(export): smoke script to validate full pipeline end-to-end"
```

---

## Task 14 — Mise à jour de la documentation projet (optionnel)

**Files:**
- Modify: `JOURNAL.md` (s'il existe et que c'est cohérent avec la pratique du projet)

- [ ] **Step 1: Vérifier l'existence de JOURNAL.md**

Run:
```bash
ls JOURNAL.md 2>/dev/null && echo "exists"
```

- [ ] **Step 2: Si oui, ajouter une entrée datée**

Au format observé dans le projet, ajouter une entrée du jour décrivant :
- Routes ajoutées : `/api/exports/patients`
- Composants : `<ExportFormatMenu>`
- Formats : CSV enrichi (~50 cols) + XLSX 4 feuilles + JSON
- Section IA : recommandation Haiku par patient avec fallback silencieux
- Migration : `/admin/psychology/export` devient alias 307

- [ ] **Step 3: Commit**

```bash
git add JOURNAL.md
git commit -m "docs(journal): enriched patient exports (csv/xlsx/json + IA reco)"
```

Si JOURNAL.md n'existe pas, skip cette tâche entièrement.

---

## Self-Review (déjà passée par l'auteur du plan)

**1. Spec coverage** :
- §3 Architecture UI → Tasks 10-12 ✓
- §4 Architecture backend → Tasks 4-9 ✓
- §5 Schema PatientExportRecord → Task 1 ✓
- §6 i18n → Task 1 (codes) + Task 4 (tags_label) + Task 3 (prompt) + Task 10 (sélecteur) ✓
- §7 Recommandation IA → Tasks 2-3 ✓
- §8 Formats CSV/XLSX/JSON → Tasks 5-7 ✓
- §9 Tests : remplacés par smoke-export.ts (Task 13) — décision documentée en haut du plan
- §10 Migration → Task 9 ✓
- §11 Storytelling démo → Task 13 step 5 (pré-vérification qualité reco)
- §12 Hors scope → respecté (pas de PDF, pas d'audit log, pas de cache cross-requête)
- §13 Risques → mitigations encodées (p-limit Task 4, fallback Task 3)

**2. Placeholders** : aucun TODO/TBD résiduel. Tous les codes blocks sont complets.

**3. Type consistency** :
- `PatientExportRecord` défini Task 1, utilisé partout
- `combineUrgency` / `computeUrgencyBase` cohérents Task 2 ↔ Task 4
- `generateRecommendation` retourne `{ recommendation, urgencyBoost }` (Task 3) consommé tel quel par Task 4
- `ExportFormat` / `ExportLocale` cohérents entre types, route, et composant

**4. Ambiguïtés** :
- Task 11 fait référence à un `exportableIds` qu'on suppose présent dans le composant existant — l'engineer doit lire le code actuel de `patients-table.tsx` autour de la ligne 201 pour le réutiliser. Si la variable a un autre nom, l'adapter.
- Task 11 mentionne aussi `locale` dans le tooltip — c'est la `useLocale()` du composant existant ; à confirmer en lisant le fichier.
