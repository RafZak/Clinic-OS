import { sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { programs } from "@/db/schema";
import { FileText, Mic, Sheet } from "lucide-react";

type IngestedFile = {
  drive_file_id: string;
  source_file: string;
  source_type: "pdf" | "video_transcript" | "docx";
  program_slug: string | null;
  module_number: number | null;
  chunk_count: number;
  last_modified: string;
};

const TYPE_ICON = {
  pdf: FileText,
  docx: Sheet,
  video_transcript: Mic,
} as const;

export async function FilesTable() {
  const t = await getTranslations("admin.knowledge");
  const TYPE_LABEL = {
    pdf: "PDF",
    docx: "DOCX",
    video_transcript: t("videoLabel"),
  } as const;

  const [rows, programRows] = await Promise.all([
    db.execute<IngestedFile>(sql`
      SELECT
        drive_file_id,
        source_file,
        source_type::text as source_type,
        program_slug,
        module_number,
        max(drive_modified_at)::text as last_modified,
        count(*)::int as chunk_count
      FROM knowledge_chunks
      GROUP BY drive_file_id, source_file, source_type, program_slug, module_number
      ORDER BY program_slug NULLS LAST, source_file
    `),
    db.select({ slug: programs.slug, title: programs.title }).from(programs),
  ]);

  const slugToTitle = new Map<string, string>();
  for (const p of programRows) slugToTitle.set(p.slug, p.title);

  const grouped = rows.reduce<Record<string, IngestedFile[]>>((acc, row) => {
    const key = row.program_slug ?? "autres";
    (acc[key] ??= []).push(row);
    return acc;
  }, {});

  const programOrder = [
    "reference",
    "personnel-accueil",
    "convaincre-telephone",
    "audio-vente",
    "autres",
  ].filter((k) => grouped[k]?.length);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div>
        <h2 className="text-base font-semibold">{t("filesTitle")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("filesDescription", { count: rows.length })}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {programOrder.map((slug) => {
          const files = grouped[slug];
          const totalChunks = files.reduce((sum, f) => sum + f.chunk_count, 0);
          const groupTitle = slug === "autres" ? t("groupOthers") : slugToTitle.get(slug) ?? slug;
          return (
            <div key={slug} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 pb-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupTitle}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("filesGroupSummary", { files: files.length, chunks: totalChunks })}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface-muted">
                {files.map((f) => {
                  const Icon = TYPE_ICON[f.source_type] ?? FileText;
                  return (
                    <li
                      key={f.drive_file_id}
                      className="grid grid-cols-[auto,1fr,auto,auto,auto] items-center gap-3 px-3 py-2 text-sm"
                    >
                      <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{f.source_file}</p>
                      </div>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {TYPE_LABEL[f.source_type] ?? f.source_type}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {f.module_number ? t("moduleShort", { n: f.module_number }) : "—"}
                      </span>
                      <span className="w-16 text-right text-xs tabular-nums text-ink">
                        {t("fileChunks", { count: f.chunk_count })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted-foreground">
            {t("filesEmpty")}
          </p>
        )}
      </div>
    </div>
  );
}
