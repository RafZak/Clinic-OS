import { NextResponse, after } from "next/server";
import { analyzeSession } from "@/lib/analysis/analyze";
import { generateAllArtifacts } from "@/lib/artifacts/generate";
import { updateVaultForSession } from "@/lib/vault/ingest";

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
    // l'update du vault Layer B EN PARALLÈLE, en appelant directement les
    // fonctions (pas de fetch HTTP interne : URL/cold start fragiles, Vercel
    // peut couper). after() garantit l'exécution post-réponse jusqu'à
    // maxDuration sans bloquer le client.
    if ("ok" in outcome && outcome.ok) {
      after(async () => {
        const run = async (label: string, fn: () => Promise<unknown>) => {
          try {
            await fn();
          } catch (err) {
            console.warn(
              `${label} post-analyze failed for ${id}:`,
              err instanceof Error ? err.message : err
            );
          }
        };
        await Promise.all([
          run("artifacts", () => generateAllArtifacts(id)),
          run("vault", () => updateVaultForSession(id)),
        ]);
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
