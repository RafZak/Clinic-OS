import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { transcriptLines } from "@/db/schema";

export const runtime = "nodejs";

const BodySchema = z.object({
  lines: z
    .array(
      z.object({
        speaker: z.enum(["practitioner", "patient"]),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
        text: z.string().min(1),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data.lines.map((l) => ({
    sessionId: id,
    speaker: l.speaker,
    startMs: l.startMs,
    endMs: l.endMs,
    text: l.text,
    confidence: l.confidence != null ? l.confidence.toFixed(3) : null,
  }));

  await db.insert(transcriptLines).values(rows);
  return NextResponse.json({ inserted: rows.length });
}
