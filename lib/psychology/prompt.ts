/**
 * Prompt template pour le scoring psychologique des 6 axes patient.
 * Version trackée en DB (`promptVersion`) pour permettre re-scoring après évolution.
 * Cf. spec: docs/superpowers/specs/2026-05-08-patient-psychology-design.md §5
 */

import { CLAUDE_MODELS } from "@/lib/claude";
import {
  PSY_AXES,
  PSY_AXIS_DESCRIPTION,
  PSY_AXIS_LABEL,
  type PsyAxis,
} from "./axes";

/**
 * Bumper cette version invalide les snapshots existants côté logique métier
 * (UI peut afficher un badge "à re-scorer" en comparant à la version courante).
 */
export const PSY_PROMPT_VERSION = "psy-v1";

/** Modèle utilisé pour scorer — Sonnet 4.x pour la qualité du raisonnement comportemental. */
export const PSY_MODEL = CLAUDE_MODELS.sonnet;

type BuildPsyPromptInput = {
  transcript: string;
  sessionKind: "consultation" | "phone_call";
  durationSeconds: number | null;
};

const KIND_LABEL: Record<BuildPsyPromptInput["sessionKind"], string> = {
  consultation: "consultation",
  phone_call: "appel téléphonique entrant",
};

function buildAxesBlock(): string {
  return PSY_AXES.map((axis: PsyAxis, idx) => {
    return `${idx + 1}. **${axis}** — ${PSY_AXIS_LABEL[axis]} : ${PSY_AXIS_DESCRIPTION[axis]}`;
  }).join("\n");
}

function buildJsonShape(): string {
  const axesShape = PSY_AXES.map(
    (axis) =>
      `    "${axis}": {"score": <0-10 ou null>, "rationale": "...", "citation": "..."}`
  ).join(",\n");
  return `{
  "axes": {
${axesShape}
  },
  "observed_keywords": ["...", "..."]
}`;
}

function formatDuration(durationSeconds: number | null): string {
  if (durationSeconds === null || durationSeconds <= 0) return "durée inconnue";
  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} min`;
}

export function buildPsyPrompt(input: BuildPsyPromptInput): string {
  const kindLabel = KIND_LABEL[input.sessionKind];
  const duration = formatDuration(input.durationSeconds);
  const axesBlock = buildAxesBlock();
  const jsonShape = buildJsonShape();

  return `Tu es un analyste comportemental senior spécialisé dans les parcours patients en audioprothèse. Tu analyses la psychologie du PATIENT (jamais du professionnel) à partir du verbatim d'une interaction réelle.

CONTEXTE DE LA SESSION
- Type : ${kindLabel}
- Durée : ${duration}

OBJECTIF
Évaluer 6 axes psychologiques du patient sur une échelle 0-10 à partir de signaux observables dans le transcript.

LES 6 AXES À SCORER
${axesBlock}

RÈGLES DE NOTATION
- Score 0-10 uniquement si tu identifies au moins 2 signaux observables dans le transcript pour cet axe.
- Score \`null\` si l'axe n'est pas observable dans cette interaction (cas fréquent sur appels courts ou interactions partielles). Mieux vaut un \`null\` honnête qu'un score inventé.
- Pour chaque axe scoré : 1-2 phrases de \`rationale\` factuelle (cite les signaux observés) + 1 \`citation\` EXACTE extraite du transcript (verbatim, pas de paraphrase). Si l'axe est null, mets \`rationale\` et \`citation\` à \`null\`.
- Ne déduis rien au-delà du transcript : pas d'hypothèses sur l'âge, l'historique médical, la situation familiale ou financière au-delà de ce que le patient dit.
- Tu coaches le PATIENT (dispositions, doutes, ouverture, freins, motivations) — pas le professionnel.
- \`observed_keywords\` : 3-8 mots-clés courts (1-3 mots chacun) repris du verbatim qui résument l'état d'esprit du patient ("je verrai avec ma femme", "trop cher", "je veux entendre mes petits-enfants", etc.).

FORMAT DE SORTIE
Réponds UNIQUEMENT avec un JSON valide, sans préambule, sans markdown, sans \`\`\`fence\`\`\` :

${jsonShape}

TRANSCRIPT À ANALYSER

---
${input.transcript}
---`;
}
