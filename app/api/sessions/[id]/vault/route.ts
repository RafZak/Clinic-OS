import { NextResponse } from "next/server";
import { updateVaultForSession } from "@/lib/vault/ingest";

// Vercel Pro : jusqu'à 300 s. Patches vault + writes Storage/DB peuvent grimper
// sur une longue consultation ; même marge que /analyze.
export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await updateVaultForSession(id);
    return NextResponse.json(
      { ok: true, sessionId: id, result },
      { status: result.ok ? 200 : 500 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, sessionId: id, error: msg }, { status: 500 });
  }
}
