import "server-only";
import { CLAUDE_MODELS, getAnthropic } from "../claude";
import { semanticSearch, type RetrievalResult } from "./search";

export type SynthesizeOptions = {
  topK?: number;
};

export type SynthesisChunk =
  | { type: "sources"; sources: RetrievalResult[] }
  | { type: "text"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };

const SYSTEM_PROMPT = `Tu es Clinic OS, un assistant pour audioprothésistes et assistants d'accueil du réseau Amplifon. Tu réponds en français avec un ton professionnel, factuel, bienveillant sans complaisance — comme un manager senior respectueux.

Ta mission : répondre à une question métier en t'appuyant UNIQUEMENT sur les extraits de formation fournis. Tu es à la fois rapide et précis.

Règles de réponse :
- Réponds directement à la question, sans préambule ("Bien sûr…", "Voici…", etc.)
- Synthétise, ne paraphrase pas. Si la formation propose une méthode, donne la méthode.
- Cite tes sources en insérant [1], [2]… après chaque affirmation importante, en référence à la numérotation des extraits.
- Si plusieurs extraits disent la même chose, cite-les ensemble : [1][3].
- Si la question sort du périmètre des extraits fournis, dis-le honnêtement en une phrase.
- Pas d'emojis. Pas de "En conclusion". Pas de liste à puces artificielle si le contenu ne s'y prête pas.
- Longueur : 120 à 250 mots, sauf si la question demande explicitement plus court ou plus long.`;

function buildUserPrompt(query: string, sources: RetrievalResult[]): string {
  const excerpts = sources
    .map((s, i) => {
      const header = `[${i + 1}] ${s.programSlug ?? "—"}${
        s.moduleNumber ? ` · module ${s.moduleNumber}` : ""
      } — ${s.sourceFile}`;
      return `${header}\n${s.content.trim()}`;
    })
    .join("\n\n---\n\n");

  return `Question de l'utilisateur : « ${query} »

Extraits des formations (classés par pertinence, les plus proches en tête) :

${excerpts}

Formule une réponse synthétique et utilisable en appui sur ces extraits. N'oublie pas les citations [N].`;
}

export async function* synthesizeAnswer(
  query: string,
  opts: SynthesizeOptions = {}
): AsyncGenerator<SynthesisChunk> {
  const topK = opts.topK ?? 12;

  let sources: RetrievalResult[];
  try {
    sources = await semanticSearch(query, { topK });
  } catch (err) {
    yield {
      type: "error",
      message: `Recherche impossible : ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
    return;
  }

  yield { type: "sources", sources };

  if (sources.length === 0) {
    yield {
      type: "text",
      delta:
        "Aucun extrait pertinent n'a été trouvé dans les formations ingérées pour cette requête.",
    };
    yield { type: "done" };
    return;
  }

  const anthropic = getAnthropic();
  try {
    const stream = anthropic.messages.stream({
      model: CLAUDE_MODELS.haiku,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(query, sources) }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text", delta: event.delta.text };
      }
    }
    yield { type: "done" };
  } catch (err) {
    yield {
      type: "error",
      message: `Synthèse Claude échouée : ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
