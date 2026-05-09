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
