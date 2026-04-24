import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";

export const runtime = "nodejs";

/**
 * Endpoint léger utilisé par le polling côté page résultats.
 * Retourne juste l'état d'avancement de l'analyse.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      analysisStatus: sessions.analysisStatus,
      analysisError: sessions.analysisError,
      globalScore: sessions.globalScore,
      analyzedAt: sessions.analyzedAt,
    })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}
