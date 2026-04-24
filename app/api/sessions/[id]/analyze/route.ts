import { NextResponse } from "next/server";
import { analyzeSession } from "@/lib/analysis/analyze";

// Vercel Pro : 60 s max. Claude Sonnet 4.6 sur un transcript 5-10 min = 15-25 s.
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const outcome = await analyzeSession(id);
    return NextResponse.json({ ok: true, sessionId: id, outcome }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, sessionId: id, error: msg },
      { status: 500 }
    );
  }
}
