import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, programs, modules } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type NavIndexItem =
  | { type: "patient"; id: string; label: string; subtitle: string; href: string }
  | { type: "program"; id: string; label: string; subtitle: string; href: string }
  | { type: "module"; id: string; label: string; subtitle: string; href: string };

export async function GET() {
  const [patientRows, programRows, moduleRows] = await Promise.all([
    db
      .select({ id: patients.id, label: patients.label, status: patients.status })
      .from(patients)
      .orderBy(asc(patients.label)),
    db
      .select({
        id: programs.id,
        slug: programs.slug,
        title: programs.title,
        category: programs.category,
        isAvailable: programs.isAvailable,
      })
      .from(programs)
      .where(eq(programs.isAvailable, true))
      .orderBy(asc(programs.orderIdx)),
    db
      .select({
        id: modules.id,
        number: modules.number,
        title: modules.title,
        programId: modules.programId,
      })
      .from(modules)
      .orderBy(asc(modules.programId), asc(modules.number)),
  ]);

  const programById = new Map(
    programRows.map((p) => [p.id, { slug: p.slug, title: p.title }])
  );

  const items: NavIndexItem[] = [];

  for (const p of patientRows) {
    items.push({
      type: "patient",
      id: p.id,
      label: p.label,
      subtitle: p.status,
      href: `/patients/${p.id}`,
    });
  }

  for (const p of programRows) {
    items.push({
      type: "program",
      id: p.id,
      label: p.title,
      subtitle: p.category,
      href: `/catalogue/${p.slug}`,
    });
  }

  for (const m of moduleRows) {
    if (!m.programId) continue;
    const parent = programById.get(m.programId);
    if (!parent) continue;
    items.push({
      type: "module",
      id: m.id,
      label: `Module ${m.number} — ${m.title}`,
      subtitle: parent.title,
      href: `/catalogue/${parent.slug}#module-${m.number}`,
    });
  }

  return NextResponse.json(
    { items },
    {
      headers: {
        "cache-control": "private, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
