import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODELS = {
  /** LLM principal : analyse consultation, vault, artefacts lourds. */
  sonnet: "claude-sonnet-4-6",
  /** LLM rapide : recherche, SMS, synthèses courtes. */
  haiku: "claude-haiku-4-5-20251001",
} as const;

let cached: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");
  cached = new Anthropic({ apiKey });
  return cached;
}
