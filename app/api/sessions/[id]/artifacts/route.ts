import { NextResponse } from "next/server";
import {
  generateAllArtifacts,
  generateOneArtifact,
  type ArtifactType,
} from "@/lib/artifacts/generate";

// Vercel Pro : jusqu'à 300 s. Les 4 artefacts en parallèle restent typiquement
// sous 30 s, mais une consultation longue peut faire dérailler Sonnet ; on
// garde la même marge que /analyze pour éviter les zombies.
export const maxDuration = 300;
export const runtime = "nodejs";

const VALID_TYPES = new Set<ArtifactType>([
  "clinical_notes",
  "patient_email",
  "patient_sms",
  "orl_letter",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let type: ArtifactType | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as { type?: string };
    if (body.type && VALID_TYPES.has(body.type as ArtifactType)) {
      type = body.type as ArtifactType;
    }
  } catch {
    // body vide → regenerate all
  }

  try {
    if (type) {
      const result = await generateOneArtifact(id, type);
      return NextResponse.json(
        { ok: true, sessionId: id, results: [result] },
        { status: result.ok ? 200 : 500 }
      );
    }
    const results = await generateAllArtifacts(id);
    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json(
      { ok: true, sessionId: id, results, okCount },
      { status: okCount > 0 ? 200 : 500 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, sessionId: id, error: msg }, { status: 500 });
  }
}
