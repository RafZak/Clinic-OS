import { NextResponse } from "next/server";
import { resolveDynamicCrumbs } from "@/lib/breadcrumbs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path || !path.startsWith("/")) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }
  try {
    const crumbs = await resolveDynamicCrumbs(path);
    return NextResponse.json({ crumbs });
  } catch (err) {
    console.error("[api/breadcrumb] failed:", err);
    return NextResponse.json({ crumbs: [] });
  }
}
