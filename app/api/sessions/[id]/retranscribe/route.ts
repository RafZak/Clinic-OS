import { NextResponse } from "next/server";
import { after } from "next/server";
import { retranscribeSession } from "@/lib/analysis/retranscribe";
import { getSiteUrl } from "@/lib/site-url";

// Vercel Pro : jusqu'à 300 s. Deepgram batch sur un webm 15-20 min peut grimper ;
// même marge que /analyze pour éviter les zombies.
export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const outcome = await retranscribeSession(id);

    // Chaîne vers analyze après envoi de la réponse (after() survit au retour
    // côté Vercel, sleep <quelques secondes> max pour laisser le kick partir).
    after(async () => {
      try {
        const res = await fetch(`${getSiteUrl()}/api/sessions/${id}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          console.warn(
            `analyze kick non-OK for ${id}: ${res.status} ${await res.text().catch(() => "")}`
          );
        }
      } catch (err) {
        console.warn(`analyze kick failed for ${id}`, err);
      }
    });

    return NextResponse.json({ ok: true, sessionId: id, outcome }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, sessionId: id, error: msg },
      { status: 500 }
    );
  }
}
