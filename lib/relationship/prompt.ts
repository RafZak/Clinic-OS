import { CLAUDE_MODELS } from "@/lib/claude";
import { COMMUNICATION_KEYS, SETBACK_KEYS, PRIORITY_KEYS } from "./taxonomy";

export const REL_PROMPT_VERSION = "rel-v2";
export const REL_MODEL = CLAUDE_MODELS.sonnet;

type BuildRelPromptInput = { patientLabel: string; transcript: string };

export function buildRelationshipPrompt(input: BuildRelPromptInput): string {
  return `Tu es un audioprothésiste senior qui rédige une synthèse relationnelle privée sur un patient, à l'usage du clinicien qui le suit. Tu analyses la relation de soin et le parcours commercial à partir du verbatim de toutes ses sessions.

PATIENT : ${input.patientLabel}

OBJECTIF
1. Rédiger une SYNTHÈSE CONTEXTUELLE en prose (3-5 paragraphes, markdown léger) : profil d'entrée, ressorts et freins, déroulé session par session, état de la relation, risque de décrochage, prochaine action recommandée. Tu peux y inclure l'impact commercial (panier, montée/descente en gamme) — c'est la lecture privée du clinicien. Produis cette synthèse en DEUX langues : une version française (abstract_md_fr) ET une version anglaise (abstract_md_en) qui doit être une traduction fidèle et professionnelle de la version française.
2. Identifier des TAGS structurés à partir de listes FERMÉES (n'invente aucune clé hors liste) :
   - communication_style : comment le patient préfère être informé. lead = le style dominant (ou null). relevant = autres styles pertinents. Clés autorisées : ${COMMUNICATION_KEYS.join(", ")}.
   - setbacks : ce qui freine le soin. present = sous-ensemble pertinent. Clés autorisées : ${SETBACK_KEYS.join(", ")}.
   - priorities : ce qui compte le plus pour le patient. lead = priorité n°1 (ou null). relevant = autres priorités citées. Clés autorisées : ${PRIORITY_KEYS.join(", ")}.

RÈGLES
- Ne déduis rien au-delà du verbatim. Si un bloc n'est pas observable, renvoie des listes vides et lead null.
- Ton factuel et professionnel. Tu décris la relation de soin, jamais un jugement sur la personne.

Renseigne le résultat via l'outil \`record_synthesis\`.

VERBATIM DE TOUTES LES SESSIONS
---
${input.transcript}
---`;
}
