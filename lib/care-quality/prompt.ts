import { CLAUDE_MODELS } from "@/lib/claude";

export const CARE_PROMPT_VERSION = "care-v1";
export const CARE_MODEL = CLAUDE_MODELS.sonnet;

export function buildClinicianCarePrompt(input: {
  practitionerLabel: string;
  transcript: string;
}): string {
  return `Tu évalues la QUALITÉ DE SOIN d'un audioprothésiste (le PROFESSIONNEL, jamais le patient) à partir du verbatim de toutes ses consultations. Logique de soin, jamais de vente.

PROFESSIONNEL : ${input.practitionerLabel}

Évalue 6 axes sur 0-100, agrégés sur l'ensemble des consultations :
- rapport : confiance et chaleur, le patient se sent entendu (reformulation empathique, écoute active).
- pedagogy : clarté d'explication, vérifie la compréhension du patient (jamais la persuasion).
- structure : visite complète (anamnèse, reformulation du besoin, options, prochaines étapes).
- guidance : aide le patient à décider sereinement (jamais conclure une vente).
- followThrough : continuité après la visite, relances pertinentes (jamais relance pour upsell).
- adaptability : éventail de styles relationnels mobilisés selon les patients.

Pour chaque axe : un score 0-100 + une rationale d'1 phrase, en français ET en anglais. Si un axe n'est pas observable, score null et rationale null. Reste factuel, fondé sur le verbatim, sans jugement de personnalité.

Renseigne le résultat via l'outil record_care_profile.

VERBATIM DES CONSULTATIONS
---
${input.transcript}
---`;
}
