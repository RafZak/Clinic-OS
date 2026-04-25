import "server-only";
import { db } from "@/db/client";
import { programs } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";

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

export type ProgramFile = {
  driveFileId: string;
  sourceFile: string;
};

export type ProgramModule = {
  number: number;
  video: ProgramFile | null;
  pdfs: ProgramFile[];
  docxs: ProgramFile[];
};

type RawFileRow = {
  drive_file_id: string;
  source_file: string;
  source_type: "pdf" | "docx" | "video_transcript";
  module_number: number | null;
};

export async function getProgramModules(slug: string): Promise<ProgramModule[]> {
  const rows = await db.execute<RawFileRow>(sql`
    SELECT DISTINCT
      drive_file_id,
      source_file,
      source_type::text as source_type,
      module_number
    FROM knowledge_chunks
    WHERE program_slug = ${slug}
      AND drive_file_id IS NOT NULL
    ORDER BY module_number NULLS LAST, source_file
  `);

  const byNum = new Map<number, ProgramModule>();
  for (const r of rows) {
    const num = r.module_number ?? 0;
    let mod = byNum.get(num);
    if (!mod) {
      mod = { number: num, video: null, pdfs: [], docxs: [] };
      byNum.set(num, mod);
    }
    const f: ProgramFile = {
      driveFileId: r.drive_file_id,
      sourceFile: r.source_file,
    };
    if (r.source_type === "video_transcript" && !mod.video) {
      mod.video = f;
    } else if (r.source_type === "pdf") {
      mod.pdfs.push(f);
    } else if (r.source_type === "docx") {
      mod.docxs.push(f);
    }
  }
  return Array.from(byNum.values()).sort((a, b) => a.number - b.number);
}

export function moduleTitle(m: ProgramModule): string {
  if (m.number === 0) return "Ressources complémentaires";
  return `Module ${m.number}`;
}

export function moduleDriveIds(m: ProgramModule): string[] {
  const ids: string[] = [];
  if (m.video) ids.push(m.video.driveFileId);
  for (const p of m.pdfs) ids.push(p.driveFileId);
  for (const d of m.docxs) ids.push(d.driveFileId);
  return ids;
}
