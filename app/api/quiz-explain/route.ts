import { NextRequest } from "next/server";
import { getQuizQuestion } from "@/lib/quizzes";
import { semanticSearch } from "@/lib/retrieval/search";
import { CLAUDE_MODELS, getAnthropic } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";
  const given: string[] = Array.isArray(body?.given) ? body.given : [];

  if (!questionId) {
    return new Response("questionId requis", { status: 400 });
  }

  const ctx = await getQuizQuestion(questionId);
  if (!ctx) {
    return new Response("question introuvable", { status: 404 });
  }
  const { question, set } = ctx;

  const correctLabels = question.choices
    .filter((c) => question.correctIds.includes(c.id))
    .map((c) => `« ${c.label} »`)
    .join(", ");
  const givenLabels = question.choices
    .filter((c) => given.includes(c.id))
    .map((c) => `« ${c.label} »`)
    .join(", ");

  let sourcesBlock = "";
  try {
    const sources = await semanticSearch(question.prompt, {
      topK: 4,
      programSlug: set.programSlug,
    });
    if (sources.length > 0) {
      sourcesBlock = sources
        .slice(0, 3)
        .map((s, i) => `[${i + 1}] (${s.sourceFile}) ${s.content.slice(0, 350)}`)
        .join("\n\n");
    }
  } catch {
    // pas critique, on continue sans sources
  }

  const system = `Tu es un coach de formation pour audioprothésistes/assistants accueil. Un apprenant vient de se tromper à un quiz. Tu lui expliques en 2 phrases CONCISES pourquoi sa réponse est incorrecte et quelle est la bonne logique, en t'appuyant sur les sources fournies si pertinentes. Vouvoiement, ton bienveillant et factuel. Pas de préambule. Pas d'emojis. Cite tes sources entre crochets [1] [2] si tu en utilises.`;

  const user = `Question : ${question.prompt}

Réponse(s) correcte(s) : ${correctLabels}
Réponse(s) donnée(s) par l'apprenant : ${givenLabels || "(aucune)"}

Explication officielle (briève) : ${question.explanation}

${sourcesBlock ? `Sources de formation :\n\n${sourcesBlock}` : ""}

Explique en 2 phrases pourquoi sa réponse est fausse et la bonne logique.`;

  const anthropic = getAnthropic();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const resp = await anthropic.messages.stream({
          model: CLAUDE_MODELS.haiku,
          max_tokens: 280,
          system,
          messages: [{ role: "user", content: user }],
        });
        for await (const event of resp) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `Impossible de générer l'explication (${
              err instanceof Error ? err.message : "erreur"
            }).`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
