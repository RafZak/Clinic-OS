import "server-only";
import { and, asc, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  transcriptLines,
  sessionScores,
  coachingInsights,
} from "@/db/schema";
import { getAnthropic, CLAUDE_MODELS } from "@/lib/claude";
import { getScorableFramework, getStepName, getStepDescription, getCriterionLabel, type FrameworkKind, type FrameworkStep } from "@/lib/frameworks";
import { enrichInsightsWithCitations } from "@/lib/analysis/citations";
import {
  PHONE_CALL_TYPES,
  RECOMMENDED_ACTIONS,
  LEAD_TEMPERATURES,
  DATA_CAPTURE_LEVELS,
  parsePhoneTags,
  type PhoneCallTags,
  type SessionMetadata,
} from "@/lib/phone-tags";
import { readSessionLocale } from "@/lib/sessions";
import type { Locale } from "@/lib/locale";
import { getLocaleInstruction, getSpeakerLabels, getKindLabel } from "@/lib/i18n/llm";

export type AnalyzeOutcome =
  | { ok: true; insights: number; globalScore: number }
  | { skipped: "not-ready" | "no-transcript" };

const INSIGHT_TYPES = [
  "missed_objection",
  "upsell_missed",
  "good_practice",
  "improvement",
] as const;
const INSIGHT_SEVERITIES = ["info", "warning", "critical"] as const;

type RawScore = {
  step_number: number;
  step_name: string;
  score: number | null;
  rationale: string;
  examples: string[] | null;
};

type RawInsight = {
  type: (typeof INSIGHT_TYPES)[number];
  severity: (typeof INSIGHT_SEVERITIES)[number];
  title: string;
  description: string;
  timestamp_ms: number | null;
  related_step: number | null;
  estimated_impact_eur: number | null;
};

type AnalysisPayload = {
  scores: RawScore[];
  insights: RawInsight[];
  summary: string;
  global_score: number;
  phone_tags?: unknown;
};

export async function analyzeSession(sessionId: string): Promise<AnalyzeOutcome> {
  const t0 = Date.now();

  const locked = await db
    .update(sessions)
    .set({ analysisStatus: "analyzing" })
    .where(
      and(
        eq(sessions.id, sessionId),
        or(
          eq(sessions.analysisStatus, "transcribed"),
          eq(sessions.analysisStatus, "failed")
        )
      )
    )
    .returning({ id: sessions.id, kind: sessions.kind, metadata: sessions.metadata });

  if (locked.length === 0) {
    return { skipped: "not-ready" };
  }

  const kind = (locked[0].kind ?? "consultation") as FrameworkKind;
  const locale = readSessionLocale(locked[0].metadata);

  try {
    const lines = await db
      .select()
      .from(transcriptLines)
      .where(eq(transcriptLines.sessionId, sessionId))
      .orderBy(asc(transcriptLines.startMs));

    if (lines.length === 0) {
      await db
        .update(sessions)
        .set({
          analysisStatus: "failed",
          analysisError: "analyze: transcript vide",
        })
        .where(eq(sessions.id, sessionId));
      log(sessionId, "analyze", "no-transcript", Date.now() - t0);
      return { skipped: "no-transcript" };
    }

    const framework = getScorableFramework(kind);
    const transcriptText = formatTranscript(lines, kind, locale);

    const payload = await callClaude(kind, framework, transcriptText, locale);
    const normalized = normalize(payload, framework, locale);
    const phoneTags = kind === "phone_call" ? parsePhoneTags(payload.phone_tags) : null;

    // Enrichissement citations Layer A (best effort — une panne retrieval
    // ne doit pas faire planter l'analyse)
    const insightsWithCitations = await safeEnrich(normalized.insights).catch(
      (err) => {
        console.warn("citations enrichment failed", err);
        return normalized.insights.map((i) => ({ ...i, citationChunks: null }));
      }
    );

    await db.transaction(async (tx) => {
      await tx.delete(sessionScores).where(eq(sessionScores.sessionId, sessionId));
      if (normalized.scores.length > 0) {
        await tx.insert(sessionScores).values(
          normalized.scores.map((s) => ({
            sessionId,
            stepNumber: s.step_number,
            stepName: s.step_name,
            score: s.score,
            rationale: s.rationale,
            examples: s.examples,
          }))
        );
      }

      await tx.delete(coachingInsights).where(eq(coachingInsights.sessionId, sessionId));
      if (insightsWithCitations.length > 0) {
        await tx.insert(coachingInsights).values(
          insightsWithCitations.map((i) => ({
            sessionId,
            type: i.type,
            severity: i.severity,
            title: i.title,
            description: i.description,
            timestampMs: i.timestamp_ms,
            relatedStep: i.related_step,
            estimatedImpactEur: i.estimated_impact_eur,
            citationChunks: i.citationChunks,
          }))
        );
      }

      const updatePayload: {
        analysisStatus: "done";
        analyzedAt: Date;
        globalScore: number;
        summary: string;
        analysisError: null;
        metadata?: SessionMetadata;
      } = {
        analysisStatus: "done",
        analyzedAt: new Date(),
        globalScore: normalized.global_score,
        summary: normalized.summary,
        analysisError: null,
      };
      if (phoneTags) {
        const existing = await tx
          .select({ metadata: sessions.metadata })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .limit(1);
        const prev = (existing[0]?.metadata as SessionMetadata | null) ?? {};
        updatePayload.metadata = { ...prev, tags: phoneTags };
      }
      await tx
        .update(sessions)
        .set(updatePayload)
        .where(eq(sessions.id, sessionId));
    });

    log(sessionId, "analyze", "ok", Date.now() - t0, {
      insights: insightsWithCitations.length,
      globalScore: normalized.global_score,
      phoneTags: phoneTags
        ? `${phoneTags.call_type}/${phoneTags.recommended_action}/${phoneTags.lead_temperature}/${phoneTags.data_capture}`
        : null,
    });
    return { ok: true, insights: insightsWithCitations.length, globalScore: normalized.global_score };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(sessions)
      .set({ analysisStatus: "failed", analysisError: `analyze: ${msg}`.slice(0, 2000) })
      .where(eq(sessions.id, sessionId));
    log(sessionId, "analyze", "failed", Date.now() - t0, { error: msg });
    throw err;
  }
}

function formatTranscript(
  lines: (typeof transcriptLines.$inferSelect)[],
  kind: FrameworkKind,
  locale: Locale
): string {
  const labels = getSpeakerLabels(kind, locale);
  return lines
    .map((l) => {
      const ts = formatTs(l.startMs);
      const who = l.speaker === "practitioner" ? labels.pro : labels.patient;
      return `[${ts}] ${who}: ${l.text}`;
    })
    .join("\n");
}

function formatTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

async function callClaude(
  kind: FrameworkKind,
  framework: FrameworkStep[],
  transcript: string,
  locale: Locale
): Promise<AnalysisPayload> {
  const anthropic = getAnthropic();
  const frameworkLabel = getKindLabel(kind, locale);

  const frameworkBlock = framework
    .map((s) => {
      const stepName = getStepName(s, locale);
      const stepDesc = getStepDescription(s, locale);
      const criteria = s.criteria
        .map((c) => `    - ${getCriterionLabel(c, locale)}`)
        .join("\n");
      return `${s.number}. ${stepName} — ${stepDesc}\n${criteria}`;
    })
    .join("\n\n");

  const phoneTaggingBlock = kind === "phone_call"
    ? `

PHILOSOPHIE APPEL ENTRANT (validée Jonathan, 25/04/2026) :
L'appel entrant est un acte de **TRIAGE**, pas un mini-acte de vente. La standardiste doit :
1. Capturer l'identité tôt (prénom + nom + email idéal, OU téléphone si pas d'email)
2. Comprendre la raison de l'appel pour router vers la bonne durée de RDV
3. Poser des questions génériques pour briefer l'audioprothésiste
4. **JAMAIS** parler gammes / prix / classe 1-2 / 100% santé / forme d'appareil — c'est le job du pro en RDV
5. **JAMAIS** demander l'ordonnance ORL en début d'appel (vécu comme agressif) — la mentionner en clôture si pertinent

Pour les appels téléphoniques, en plus des scores/insights/summary/global_score, tu dois produire un objet **phone_tags** avec exactement 5 champs :

- **call_type** (1 valeur, raison principale) :
  * new_patient — premier contact, jamais venu
  * renewal — patient existant fin de cycle (4 ans)
  * trial_followup — en essai, question / ajustement
  * tech_issue — réglage, dôme, pile, panne mineure
  * info_request — avant décision, prend la température (souvent : prix)
  * urgency — acouphène brutal, perte soudaine, douleur
  * admin — devis, facture, mutuelle, attestation

- **recommended_action** (1 valeur, action à prendre) :
  * rdv_bilan_60min · rdv_renouvellement_45min · rdv_technique_15min · rdv_technique_30min
  * rappel_pro · resolved_phone · transfer_orl · transfer_admin

- **lead_temperature** : hot (motivé) · warm (en réflexion) · cold (sceptique) · lost (raccroché sans suite)

- **data_capture** :
  * complete — prénom + nom + (email OU téléphone) capturés
  * partial — il manque un élément clé (ex: nom seulement, pas de coordonnée de rappel)
  * anonymous — aucune identité capturée (= LEAD PERDU pour le CRM)

- **data_capture_note** (string ou null) : si data_capture != "complete", explique de façon factuelle ce qui manque et ce que cela implique, SANS jugement sur le standardiste si c'est le patient qui a refusé. Exemples :
  * "Email non recueilli — relance possible uniquement par téléphone"
  * "Aucune coordonnée capturée — lead non exploitable, pas de relance possible"

INSIGHTS SUPPLÉMENTAIRES POUR APPEL ENTRANT :
- Si data_capture == "anonymous" : ajoute systématiquement un insight CRITICAL (~3000€ de panier potentiel perdu pour un new_patient).
- Si call_type == "info_request" et qu'aucun RDV n'a été proposé : ajoute un insight CRITICAL.
- Si la standardiste évoque les gammes / prix / classe 1-2 / 100% santé / forme d'appareil : ajoute un insight WARNING ("hors de son rôle, doit rester sur le triage").

`
    : "";

  const localeInstruction = getLocaleInstruction(locale);
  const system = `${localeInstruction}

Tu es un analyste senior de performance commerciale dans l'audioprothèse. Tu analyses les ${frameworkLabel}s pour coacher l'utilisateur (pas le patient).

Ton : professionnel, factuel, bienveillant sans complaisance. Vouvoie l'utilisateur. Pas de préambule ni de flatterie. Tu t'appuies uniquement sur le verbatim fourni.

Tu produis une analyse structurée selon le framework métier ${framework.length} étapes fourni. Pour chaque étape :
- score de 0 à 100 (null si l'étape n'a pas été abordée dans le transcript — ne pas mettre 0 si c'est juste absent)
- rationale en 1-2 phrases factuelles
- examples : 1 à 3 citations verbatim du transcript (optionnel, null sinon)

Tu identifies 3 à 8 insights de coaching ciblés :
- type : missed_objection | upsell_missed | good_practice | improvement
- severity : info | warning | critical
- title : court, actionnable
- description : 1-3 phrases, ancrée dans le verbatim
- timestamp_ms : moment du transcript concerné si pertinent
- related_step : numéro d'étape du framework concerné
- estimated_impact_eur : impact économique estimé en euros sur la session (ex: objection prix non traitée sur classe 2 = 480€ de panier perdu). Null si non chiffrable.

Enfin :
- summary : synthèse en 2-3 phrases, utile à l'utilisateur
- global_score : score global 0-100 pondéré selon l'importance des étapes couvertes

Les estimations euros doivent être conservatrices et réalistes pour le marché audioprothèse français (panier moyen classe 1 : 950€, classe 2 : 1800€, upsell typique : 400-800€).${phoneTaggingBlock}`;

  const user = `Framework d'analyse (${framework.length} étapes) :

${frameworkBlock}

Transcript de la session (format : [MM:SS] Locuteur: Texte) :

${transcript}

Analyse cette session selon le framework. Appelle l'outil submit_analysis avec le résultat structuré.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 6000,
    system,
    tools: [
      {
        name: "submit_analysis",
        description: "Soumet l'analyse structurée de la session.",
        input_schema: {
          type: "object",
          properties: {
            scores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step_number: { type: "integer" },
                  step_name: { type: "string" },
                  score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
                  rationale: { type: "string" },
                  examples: {
                    type: ["array", "null"],
                    items: { type: "string" },
                  },
                },
                required: ["step_number", "step_name", "score", "rationale"],
              },
            },
            insights: {
              type: "array",
              minItems: 3,
              maxItems: 8,
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: INSIGHT_TYPES as unknown as string[] },
                  severity: { type: "string", enum: INSIGHT_SEVERITIES as unknown as string[] },
                  title: { type: "string" },
                  description: { type: "string" },
                  timestamp_ms: { type: ["integer", "null"] },
                  related_step: { type: ["integer", "null"] },
                  estimated_impact_eur: { type: ["integer", "null"] },
                },
                required: ["type", "severity", "title", "description"],
              },
            },
            summary: { type: "string" },
            global_score: { type: "integer", minimum: 0, maximum: 100 },
            phone_tags: kind === "phone_call"
              ? {
                  type: "object",
                  description:
                    "Tags de triage de l'appel entrant — obligatoire pour kind='phone_call'.",
                  properties: {
                    call_type: {
                      type: "string",
                      enum: PHONE_CALL_TYPES as unknown as string[],
                    },
                    recommended_action: {
                      type: "string",
                      enum: RECOMMENDED_ACTIONS as unknown as string[],
                    },
                    lead_temperature: {
                      type: "string",
                      enum: LEAD_TEMPERATURES as unknown as string[],
                    },
                    data_capture: {
                      type: "string",
                      enum: DATA_CAPTURE_LEVELS as unknown as string[],
                    },
                    data_capture_note: { type: ["string", "null"] },
                  },
                  required: [
                    "call_type",
                    "recommended_action",
                    "lead_temperature",
                    "data_capture",
                  ],
                }
              : { type: ["object", "null"] },
          },
          required:
            kind === "phone_call"
              ? ["scores", "insights", "summary", "global_score", "phone_tags"]
              : ["scores", "insights", "summary", "global_score"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_analysis" },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas invoqué submit_analysis");
  }
  return toolUse.input as AnalysisPayload;
}

function normalize(raw: AnalysisPayload, framework: FrameworkStep[], locale: Locale): AnalysisPayload {
  const byStep = new Map(raw.scores.map((s) => [s.step_number, s]));
  const notEvaluated =
    locale === "en"
      ? "Step not evaluated by the analyzer."
      : "Étape non évaluée par l'analyseur.";
  const scores: RawScore[] = framework.map((step) => {
    const stepName = getStepName(step, locale);
    const existing = byStep.get(step.number);
    if (existing) {
      return {
        step_number: step.number,
        step_name: stepName,
        score: clampScore(existing.score),
        rationale: existing.rationale ?? "",
        examples: Array.isArray(existing.examples) ? existing.examples : null,
      };
    }
    return {
      step_number: step.number,
      step_name: stepName,
      score: null,
      rationale: notEvaluated,
      examples: null,
    };
  });

  const insights: RawInsight[] = raw.insights
    .filter((i) => INSIGHT_TYPES.includes(i.type))
    .map((i) => ({
      type: i.type,
      severity: INSIGHT_SEVERITIES.includes(i.severity) ? i.severity : "info",
      title: String(i.title ?? "").slice(0, 200),
      description: String(i.description ?? "").slice(0, 2000),
      timestamp_ms:
        typeof i.timestamp_ms === "number" && i.timestamp_ms >= 0 ? i.timestamp_ms : null,
      related_step:
        typeof i.related_step === "number" ? i.related_step : null,
      estimated_impact_eur:
        typeof i.estimated_impact_eur === "number"
          ? Math.max(0, Math.round(i.estimated_impact_eur))
          : null,
    }));

  return {
    scores,
    insights,
    summary: String(raw.summary ?? "").slice(0, 1000),
    global_score: clampScore(raw.global_score) ?? 0,
  };
}

function clampScore(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

async function safeEnrich(
  insights: RawInsight[]
): Promise<(RawInsight & { citationChunks: unknown[] | null })[]> {
  return enrichInsightsWithCitations(insights);
}

function log(
  sessionId: string,
  step: string,
  status: string,
  durationMs: number,
  extra: Record<string, unknown> = {}
) {
  console.log(
    JSON.stringify({ tag: "analysis", sessionId, step, status, durationMs, ...extra })
  );
}
