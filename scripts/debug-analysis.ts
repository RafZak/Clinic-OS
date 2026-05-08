/**
 * Debug script — reproduit l'appel Claude exact pour la session 1e849cdc
 * et logge le payload brut retourné, sans cast `as AnalysisPayload`.
 *
 * Lance N appels en parallèle pour capter une éventuelle variabilité.
 *
 * Usage : pnpm tsx scripts/debug-analysis.ts [sessionId] [n]
 *   défaut sessionId : 1e849cdc-f79d-43b1-9b0f-f0f368cabab0
 *   défaut n : 5
 *
 * Aucune écriture en base. Lecture seule.
 */
import { config } from "dotenv";
import postgres from "postgres";
import Anthropic from "@anthropic-ai/sdk";
import {
  getScorableFramework,
  getStepName,
  getStepDescription,
  getCriterionLabel,
  type FrameworkKind,
  type FrameworkStep,
} from "../lib/frameworks";

type Locale = "fr" | "en";

function getLocaleInstruction(locale: Locale): string {
  if (locale === "en") {
    return [
      "RESPOND IN ENGLISH.",
      "All your output must be in English.",
      "Currency stays in EUR (€).",
    ].join(" ");
  }
  return [
    "RÉPONDS EN FRANÇAIS.",
    "Toutes les sorties doivent être en français professionnel.",
    "Garde les noms propres et le jargon clinique tels quels.",
    "Devise en euros (€).",
  ].join(" ");
}

function getSpeakerLabels(kind: FrameworkKind, locale: Locale): { pro: string; patient: string } {
  if (locale === "en") {
    return kind === "phone_call"
      ? { pro: "Front desk", patient: "Caller" }
      : { pro: "Practitioner", patient: "Patient" };
  }
  return kind === "phone_call"
    ? { pro: "Standardiste", patient: "Appelant" }
    : { pro: "Pro", patient: "Patient" };
}

function getKindLabel(kind: FrameworkKind, locale: Locale): string {
  if (locale === "en") {
    return kind === "phone_call" ? "inbound call to a hearing-care center" : "hearing-care consultation";
  }
  return kind === "phone_call" ? "appel entrant centre audio" : "consultation audioprothèse";
}

config({ path: ".env.local" });

const SESSION_ID = process.argv[2] ?? "1e849cdc-f79d-43b1-9b0f-f0f368cabab0";
const N = Number(process.argv[3] ?? 5);
const MODEL = "claude-sonnet-4-6";

const INSIGHT_TYPES = [
  "missed_objection",
  "upsell_missed",
  "good_practice",
  "improvement",
] as const;
const INSIGHT_SEVERITIES = ["info", "warning", "critical"] as const;
const PHONE_CALL_TYPES = ["new_patient","renewal","trial_followup","tech_issue","info_request","urgency","admin"];
const RECOMMENDED_ACTIONS = ["rdv_bilan_60min","rdv_renouvellement_45min","rdv_technique_15min","rdv_technique_30min","rappel_pro","resolved_phone","transfer_orl","transfer_admin"];
const LEAD_TEMPERATURES = ["hot","warm","cold","lost"];
const DATA_CAPTURE_LEVELS = ["complete","partial","anonymous"];

function formatTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function formatTranscript(
  lines: { speaker: string; start_ms: number; text: string }[],
  kind: FrameworkKind,
  locale: Locale
): string {
  const labels = getSpeakerLabels(kind, locale);
  return lines
    .map((l) => {
      const ts = formatTs(l.start_ms);
      const who = l.speaker === "practitioner" ? labels.pro : labels.patient;
      return `[${ts}] ${who}: ${l.text}`;
    })
    .join("\n");
}

function buildSystem(kind: FrameworkKind, framework: FrameworkStep[], locale: Locale): string {
  const frameworkLabel = getKindLabel(kind, locale);
  const localeInstruction = getLocaleInstruction(locale);
  const phoneTaggingBlock = kind === "phone_call" ? "" : "";
  return `${localeInstruction}

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
}

function buildUser(framework: FrameworkStep[], transcript: string, locale: Locale): string {
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
  return `Framework d'analyse (${framework.length} étapes) :

${frameworkBlock}

Transcript de la session (format : [MM:SS] Locuteur: Texte) :

${transcript}

Analyse cette session selon le framework. Appelle l'outil submit_analysis avec le résultat structuré.`;
}

function buildTool(kind: FrameworkKind) {
  return {
    name: "submit_analysis",
    description: "Soumet l'analyse structurée de la session.",
    input_schema: {
      type: "object" as const,
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
              examples: { type: ["array", "null"], items: { type: "string" } },
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
        phone_tags:
          kind === "phone_call"
            ? {
                type: "object",
                properties: {
                  call_type: { type: "string", enum: PHONE_CALL_TYPES },
                  recommended_action: { type: "string", enum: RECOMMENDED_ACTIONS },
                  lead_temperature: { type: "string", enum: LEAD_TEMPERATURES },
                  data_capture: { type: "string", enum: DATA_CAPTURE_LEVELS },
                  data_capture_note: { type: ["string", "null"] },
                },
                required: ["call_type","recommended_action","lead_temperature","data_capture"],
              }
            : { type: ["object", "null"] },
      },
      required:
        kind === "phone_call"
          ? ["scores", "insights", "summary", "global_score", "phone_tags"]
          : ["scores", "insights", "summary", "global_score"],
    },
  };
}

async function callOnce(
  client: Anthropic,
  system: string,
  user: string,
  tool: ReturnType<typeof buildTool>,
  attempt: number
) {
  const t0 = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system,
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_analysis" },
    messages: [{ role: "user", content: user }],
  });
  const dt = Date.now() - t0;
  const toolUse = response.content.find((b) => b.type === "tool_use");
  const summary = {
    attempt,
    durationMs: dt,
    stopReason: response.stop_reason,
    usage: response.usage,
    hasToolUse: !!toolUse,
  };

  if (!toolUse || toolUse.type !== "tool_use") {
    console.log(JSON.stringify({ ...summary, error: "no tool_use", contentTypes: response.content.map((b) => b.type) }));
    return;
  }

  const input = toolUse.input as unknown;
  const root = input as Record<string, unknown> | null;
  const scores = root?.scores;
  const insights = root?.insights;
  const inspect = {
    ...summary,
    scoresType: scores === null ? "null" : Array.isArray(scores) ? "array" : typeof scores,
    scoresIsArray: Array.isArray(scores),
    scoresLength: Array.isArray(scores) ? scores.length : null,
    scoresKeysIfObject:
      scores && !Array.isArray(scores) && typeof scores === "object"
        ? Object.keys(scores as object).slice(0, 12)
        : null,
    insightsType: insights === null ? "null" : Array.isArray(insights) ? "array" : typeof insights,
    insightsIsArray: Array.isArray(insights),
    rootKeys: root ? Object.keys(root) : null,
  };
  console.log(JSON.stringify(inspect));

  // Si scores n'est pas un array, dump le payload entier pour analyse
  if (!Array.isArray(scores)) {
    console.log("=== PAYLOAD BRUT (scores non-array) ===");
    console.log(JSON.stringify(input, null, 2));
    console.log("=== FIN PAYLOAD ===");
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const sessionRows = await sql<{ id: string; kind: string; metadata: { locale?: string } | null }[]>`
    SELECT id, kind, metadata FROM sessions WHERE id = ${SESSION_ID} LIMIT 1
  `;
  if (sessionRows.length === 0) {
    console.error(`Session ${SESSION_ID} introuvable`);
    process.exit(1);
  }
  const session = sessionRows[0];
  const kind = (session.kind ?? "consultation") as FrameworkKind;
  const locale = ((session.metadata?.locale ?? "fr") as Locale);

  const lines = await sql<{ speaker: string; start_ms: number; text: string }[]>`
    SELECT speaker, start_ms, text FROM transcript_lines
    WHERE session_id = ${SESSION_ID}
    ORDER BY start_ms ASC
  `;
  console.log(`Session ${SESSION_ID} | kind=${kind} | locale=${locale} | ${lines.length} lignes transcript`);

  const framework = getScorableFramework(kind);
  const transcript = formatTranscript(lines as { speaker: string; start_ms: number; text: string }[], kind, locale);
  const system = buildSystem(kind, framework, locale);
  const user = buildUser(framework, transcript, locale);
  const tool = buildTool(kind);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  console.log(`\nLance ${N} appels Claude (${MODEL}) en parallèle…\n`);
  const results = await Promise.allSettled(
    Array.from({ length: N }, (_, i) => callOnce(client, system, user, tool, i + 1))
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const ko = results.length - ok;
  console.log(`\nTerminé : ${ok} OK, ${ko} échecs réseau/API`);
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      console.log(`Attempt ${i + 1} rejected:`, r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
