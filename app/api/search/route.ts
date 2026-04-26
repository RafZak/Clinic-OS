import { NextRequest } from "next/server";
import { synthesizeAnswer } from "@/lib/retrieval/synthesize";
import { getLocale } from "@/lib/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const locale = await getLocale();

  if (!query) {
    return new Response(
      JSON.stringify({
        error: locale === "en" ? "Empty query." : "Requête vide.",
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }
  if (query.length < 3) {
    return new Response(
      JSON.stringify({
        error:
          locale === "en"
            ? "Query too short (3 characters minimum)."
            : "Requête trop courte (3 caractères minimum).",
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of synthesizeAnswer(query, { locale })) {
          controller.enqueue(encoder.encode(sseEvent(chunk)));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
