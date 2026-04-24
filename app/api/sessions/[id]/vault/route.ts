import { NextResponse } from "next/server";
import { updateVaultForSession } from "@/lib/vault/ingest";

// Vercel Pro : 60 s. Sonnet 4.6 sur les patches vault = ~15-25 s + writes Storage/DB.
export const maxDuration = 60;
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
