import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * Alias vers la nouvelle route unifiée.
 * Préserve les liens existants pendant la transition.
 * À supprimer dans une PR ultérieure si plus aucun appelant.
 */
export async function GET(req: NextRequest) {
  const target = new URL("/api/exports/patients", req.url);
  // Forward tous les params + ajoute format=csv par défaut
  req.nextUrl.searchParams.forEach((v, k) => {
    target.searchParams.set(k, v);
  });
  if (!target.searchParams.has("format")) {
    target.searchParams.set("format", "csv");
  }
  return NextResponse.redirect(target, 307);
}
