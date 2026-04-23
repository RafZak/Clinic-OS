import "server-only";
import { db } from "@/db/client";
import { programs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export type ProgramCategory =
  | "acquisition"
  | "points-de-contact"
  | "appareillage"
  | "fidelisation";

export const CATEGORY_LABEL: Record<ProgramCategory, string> = {
  acquisition: "Acquisition",
  "points-de-contact": "Points de contact",
  appareillage: "Appareillage",
  fidelisation: "Fidélisation",
};

export const CATEGORY_ORDER: ProgramCategory[] = [
  "acquisition",
  "points-de-contact",
  "appareillage",
  "fidelisation",
];

export async function listPrograms() {
  return db.select().from(programs).orderBy(asc(programs.orderIdx));
}

export async function getProgramBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(programs)
    .where(eq(programs.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getProgramChunkStats() {
  const { sql } = await import("drizzle-orm");
  const rows = await db.execute<{
    program_slug: string;
    chunks: number;
    files: number;
  }>(sql`
    SELECT program_slug, count(*)::int as chunks, count(distinct drive_file_id)::int as files
    FROM knowledge_chunks
    WHERE program_slug IS NOT NULL
    GROUP BY program_slug
  `);
  const map = new Map<string, { chunks: number; files: number }>();
  rows.forEach((r) =>
    map.set(r.program_slug, { chunks: r.chunks, files: r.files })
  );
  return map;
}
