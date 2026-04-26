import "server-only";
import type { Locale } from "@/lib/locale";
import type { FrameworkKind } from "@/lib/frameworks";

/**
 * Instruction système à injecter en tête de chaque prompt Claude pour
 * forcer la langue de sortie. Utilisée uniformément par analyze, coach
 * tick, vault ingest, artifacts et knowledge search.
 *
 * Le contenu source (transcripts, vault existant, knowledge chunks) peut
 * rester dans sa langue d'origine — Claude lit toutes les langues. La
 * sortie doit suivre `locale`.
 */
export function getLocaleInstruction(locale: Locale): string {
  if (locale === "en") {
    return [
      "RESPOND IN ENGLISH.",
      "All your output must be in English: titles, descriptions, rationales, summaries, quoted excerpts (translate them if the original is French), markdown sections, vault entries, generated artifacts (clinical notes, patient email, patient SMS, ENT specialist letter), insight titles and descriptions.",
      "Use natural, professional English appropriate for a UK / international hearing-care professional audience.",
      "Keep all proper nouns (patient names, audiologist names, brand names, model names) and clinical jargon (audiogram, tympanometry, ENT, etc.) as-is.",
      "Currency stays in EUR (€).",
    ].join(" ");
  }
  return [
    "RÉPONDS EN FRANÇAIS.",
    "Toutes les sorties (titres, descriptions, rationales, synthèses, citations, sections markdown, fiches vault, livrables générés — notes cliniques, email patient, SMS patient, courrier ORL — titres et descriptions d'insights) doivent être en français professionnel.",
    "Garde les noms propres et le jargon clinique tels quels.",
    "Devise en euros (€).",
  ].join(" ");
}

/**
 * Labels de locuteur dans le transcript et l'UI selon la langue et le
 * type de session.
 */
export function getSpeakerLabels(
  kind: FrameworkKind,
  locale: Locale
): { pro: string; patient: string } {
  if (locale === "en") {
    return kind === "phone_call"
      ? { pro: "Front desk", patient: "Caller" }
      : { pro: "Practitioner", patient: "Patient" };
  }
  return kind === "phone_call"
    ? { pro: "Standardiste", patient: "Appelant" }
    : { pro: "Pro", patient: "Patient" };
}

/**
 * Étiquette du type de session, utile pour les prompts qui décrivent
 * le contexte métier.
 */
export function getKindLabel(kind: FrameworkKind, locale: Locale): string {
  if (locale === "en") {
    return kind === "phone_call"
      ? "inbound call to a hearing-care center"
      : "hearing-care consultation";
  }
  return kind === "phone_call"
    ? "appel entrant centre audio"
    : "consultation audioprothèse";
}
