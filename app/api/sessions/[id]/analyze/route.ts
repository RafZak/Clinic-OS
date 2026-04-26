import { NextResponse, after } from "next/server";
import { analyzeSession } from "@/lib/analysis/analyze";
import { getSiteUrl } from "@/lib/site-url";

// Vercel Pro : jusqu'à 300 s. Claude Sonnet sur un transcript 15-20 min peut
// dépasser 60 s ; on garde une marge pour éviter les zombies "analyzing".
export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const outcome = await analyzeSession(id);

    // Si l'analyse a abouti, on enchaîne sur la génération des 4 artefacts +
    // l'update du vault Layer B EN PARALLÈLE. Fire-and-forget : on ne
    // bloque pas la réponse au client (qui poll /status pour suivre l'état
    // analyse).
    if ("ok" in outcome && outcome.ok) {
      after(async () => {
        const base = getSiteUrl();
        const kick = (path: string) =>
          fetch(`${base}/api/sessions/${id}/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).then(
            (res) => {
              if (!res.ok) {
                console.warn(`${path} kick non-OK for ${id}: ${res.status}`);
              }
            },
            (err) => console.warn(`${path} kick failed for ${id}`, err)
          );
        await Promise.all([kick("artifacts"), kick("vault")]);
      });
    }

    return NextResponse.json({ ok: true, sessionId: id, outcome }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, sessionId: id, error: msg },
      { status: 500 }
    );
  }
}
