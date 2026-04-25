import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import Anthropic from "@anthropic-ai/sdk";

type ChunkRow = {
  program_slug: string;
  source_file: string;
  chunk_index: number;
  content: string;
};

type ParsedChoice = { id: string; label: string };
type ParsedQuestion = {
  position: number;
  prompt: string;
  kind: "single" | "multi" | "boolean";
  choices: ParsedChoice[];
  correct_ids: string[];
  explanation: string;
  related_module?: number | null;
};
type ParsedQuizSet = {
  ordinal: number;
  module_number?: number | null;
  title: string;
  questions: ParsedQuestion[];
};
type ParsedFile = {
  quiz_sets: ParsedQuizSet[];
};

const SONNET = "claude-sonnet-4-6";

async function callClaude(
  client: Anthropic,
  programSlug: string,
  sourceFile: string,
  rawContent: string
): Promise<ParsedFile> {
  const system = `Tu es un parser pédagogique. Tu reçois le texte brut d'un document Word/PDF qui contient un ou plusieurs quiz d'un programme de formation pour audioprothésistes.

Ton job : extraire la structure des quiz pour les rendre interactifs.

RÈGLES :
- Le document peut contenir plusieurs quiz, séparés par "Quiz #1", "Quiz #2", etc.
- Pour chaque quiz, tu repères son ordinal (Quiz #N) et le module ciblé si précisé ("apres la video #M" ou "entre module video M et N").
- Pour chaque question dans un quiz :
  - prompt : énoncé clair (sans le préfixe "Question N", sans "(cocher la bonne réponse)" — juste l'énoncé)
  - kind : 'single' (une seule bonne réponse), 'multi' (plusieurs bonnes réponses), 'boolean' (Vrai/Faux)
  - choices : tableau d'objets {id, label} avec ids 'a','b','c',... (ou 'true','false' pour boolean)
  - correct_ids : tableau des ids corrects
  - explanation : explication telle que donnée dans le doc (ou résumé clair si manquante)
- IMPORTANT : si une question est de type "ordering" (placer dans l'ordre), convertis-la en multi-choice "Cochez les étapes qui font partie du framework consultation" — toutes les bonnes réponses sont correct_ids.
- Si une réponse est notée "tous" → tous les choix sont corrects. Si "a+b+d" → ['a','b','d']. Si "Vrai" → ['true'].
- Si une explication est absente, écris une phrase factuelle de pédagogie.
- N'invente PAS de questions absentes du document. Reste fidèle au matériel pédagogique.
- Ignore les instructions internes type "Quizz à conserver pour la mise en production" ou "(Le bon ordre est le suivant. Les mélanger lorsque tu écriras la question)".

Tu invoques OBLIGATOIREMENT l'outil submit_quiz_file avec la structure complète.`;

  const user = `Programme : ${programSlug}
Fichier source : ${sourceFile}

Contenu brut du document (concat des chunks ingérés, peut avoir des chevauchements à 100 tokens — dédoublonne intelligemment) :

${rawContent}`;

  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 8000,
    system,
    tools: [
      {
        name: "submit_quiz_file",
        description:
          "Soumet la structure parsée d'un fichier quiz (1 ou plusieurs quiz_sets).",
        input_schema: {
          type: "object",
          properties: {
            quiz_sets: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  ordinal: { type: "integer", minimum: 1 },
                  module_number: { type: ["integer", "null"] },
                  title: { type: "string" },
                  questions: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      properties: {
                        position: { type: "integer", minimum: 1 },
                        prompt: { type: "string" },
                        kind: {
                          type: "string",
                          enum: ["single", "multi", "boolean"],
                        },
                        choices: {
                          type: "array",
                          minItems: 2,
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              label: { type: "string" },
                            },
                            required: ["id", "label"],
                          },
                        },
                        correct_ids: {
                          type: "array",
                          minItems: 1,
                          items: { type: "string" },
                        },
                        explanation: { type: "string" },
                        related_module: { type: ["integer", "null"] },
                      },
                      required: [
                        "position",
                        "prompt",
                        "kind",
                        "choices",
                        "correct_ids",
                        "explanation",
                      ],
                    },
                  },
                },
                required: ["ordinal", "title", "questions"],
              },
            },
          },
          required: ["quiz_sets"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_quiz_file" },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Claude n'a pas invoqué submit_quiz_file pour ${sourceFile}`);
  }
  return toolUse.input as ParsedFile;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Error("ANTHROPIC_API_KEY manquant");

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const rows = await sql<ChunkRow[]>`
    SELECT program_slug, source_file, chunk_index, content
    FROM knowledge_chunks
    WHERE source_file ILIKE '%quiz%' OR source_file ILIKE '%quizz%'
    ORDER BY program_slug, source_file, chunk_index
  `;

  const grouped = new Map<string, ChunkRow[]>();
  for (const r of rows) {
    const key = `${r.program_slug}__${r.source_file}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }

  console.log(`Found ${grouped.size} quiz files to parse\n`);

  for (const [key, chunks] of grouped.entries()) {
    const [programSlug, sourceFile] = key.split("__");
    const rawContent = chunks.map((c) => c.content).join("\n\n");
    console.log(
      `→ Parsing ${programSlug} / ${sourceFile} (${chunks.length} chunks, ${rawContent.length} chars)`
    );

    let parsed: ParsedFile;
    try {
      parsed = await callClaude(anthropic, programSlug, sourceFile, rawContent);
    } catch (e) {
      console.error(`  ✗ FAILED: ${(e as Error).message}`);
      continue;
    }

    console.log(`  ✓ Parsed ${parsed.quiz_sets.length} quiz_set(s)`);

    for (const qs of parsed.quiz_sets) {
      const moduleNum = qs.module_number ?? null;
      const passThreshold = 80;

      const upserted = await sql<{ id: string }[]>`
        INSERT INTO quiz_sets (program_slug, module_number, ordinal, title, pass_threshold, source_file)
        VALUES (${programSlug}, ${moduleNum}, ${qs.ordinal}, ${qs.title}, ${passThreshold}, ${sourceFile})
        ON CONFLICT (program_slug, ordinal) DO UPDATE
          SET module_number = EXCLUDED.module_number,
              title = EXCLUDED.title,
              pass_threshold = EXCLUDED.pass_threshold,
              source_file = EXCLUDED.source_file
        RETURNING id
      `;
      const setId = upserted[0].id;

      await sql`DELETE FROM quiz_questions WHERE quiz_set_id = ${setId}`;

      for (const q of qs.questions) {
        await sql`
          INSERT INTO quiz_questions
            (quiz_set_id, position, prompt, kind, choices, correct_ids, explanation, related_module)
          VALUES
            (${setId}, ${q.position}, ${q.prompt}, ${q.kind},
             ${sql.json(q.choices)}, ${q.correct_ids as string[]},
             ${q.explanation}, ${q.related_module ?? moduleNum ?? null})
        `;
      }
      console.log(
        `    Quiz #${qs.ordinal} "${qs.title}" → module ${moduleNum ?? "global"} · ${qs.questions.length} questions`
      );
    }
  }

  await sql.end();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
