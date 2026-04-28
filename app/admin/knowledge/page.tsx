import { desc, eq, sql } from "drizzle-orm";
import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@/db/client";
import { ingestionRuns, knowledgeChunks, programs } from "@/db/schema";
import { PageHeader } from "@/components/layout/page-header";
import { FilesTable } from "@/components/admin/files-table";
import { RetrievalTest } from "@/components/admin/retrieval-test";

export const dynamic = "force-dynamic";

function formatNumber(n: number, locale: string): string {
  return n.toLocaleString(locale === "en" ? "en-GB" : "fr-FR");
}

export default async function AdminKnowledgePage() {
  const t = await getTranslations("admin.knowledge");
  const locale = await getLocale();

  const [totalRow] = await db.execute<{ total: number }>(
    sql`SELECT count(*)::int as total FROM knowledge_chunks`
  );

  const perProgram = await db.execute<{
    program_slug: string | null;
    chunks: number;
    files: number;
  }>(sql`
    SELECT program_slug, count(*)::int as chunks, count(distinct drive_file_id)::int as files
    FROM knowledge_chunks
    GROUP BY program_slug
    ORDER BY chunks DESC
  `);

  const perType = await db.execute<{
    source_type: string;
    chunks: number;
  }>(sql`
    SELECT source_type, count(*)::int as chunks
    FROM knowledge_chunks
    GROUP BY source_type
    ORDER BY chunks DESC
  `);

  const activePrograms = await db
    .select({
      slug: programs.slug,
      title: programs.title,
      isAvailable: programs.isAvailable,
    })
    .from(programs)
    .where(eq(programs.isAvailable, true))
    .orderBy(programs.orderIdx);

  const recentRuns = await db
    .select()
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(10);

  const totalChunks = totalRow?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label={t("kpiTotal")} value={formatNumber(totalChunks, locale)} />
        <Kpi
          label={t("kpiPdf")}
          value={formatNumber(
            perType.find((p) => p.source_type === "pdf")?.chunks ?? 0,
            locale
          )}
        />
        <Kpi
          label={t("kpiVideo")}
          value={formatNumber(
            perType.find((p) => p.source_type === "video_transcript")?.chunks ?? 0,
            locale
          )}
        />
        <Kpi
          label={t("kpiDocx")}
          value={formatNumber(
            perType.find((p) => p.source_type === "docx")?.chunks ?? 0,
            locale
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-base font-semibold">{t("perProgramTitle")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("perProgramDescription")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {activePrograms.map((p) => {
              const row = perProgram.find((r) => r.program_slug === p.slug);
              const chunks = row?.chunks ?? 0;
              const files = row?.files ?? 0;
              const hasData = chunks > 0;
              const pct = totalChunks ? Math.round((chunks / totalChunks) * 100) : 0;
              return (
                <div
                  key={p.slug}
                  className="grid grid-cols-[1fr,auto,auto] items-center gap-3 rounded-md bg-surface-muted px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("slugFiles", { slug: p.slug, count: files })}
                    </p>
                  </div>
                  <div className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                    {t("chunksValue", { count: formatNumber(chunks, locale) })}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${hasData ? Math.max(pct, 4) : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-base font-semibold">{t("runsTitle")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("runsDescription")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {recentRuns.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("runsEmpty")}</p>
            )}
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] text-ink">
                    {run.startedAt
                      ? run.startedAt.toLocaleString(
                          locale === "en" ? "en-GB" : "fr-FR",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "—"}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {t("runFiles", {
                      files: run.filesProcessed ?? 0,
                      chunks: run.chunksCreated ?? 0,
                    })}
                  </p>
                </div>
                <StatusPill
                  status={run.status ?? "running"}
                  labels={t.raw("runStatus") as {
                    success: string;
                    partial: string;
                    failed: string;
                    running: string;
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <RetrievalTest />

      <FilesTable />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function StatusPill({
  status,
  labels,
}: {
  status: string;
  labels: { success: string; partial: string; failed: string; running: string };
}) {
  const map: Record<string, { className: string; label: string }> = {
    success: { className: "bg-emerald-100 text-emerald-800", label: labels.success },
    partial: { className: "bg-amber-100 text-amber-800", label: labels.partial },
    failed: { className: "bg-red-100 text-red-800", label: labels.failed },
    running: {
      className: "bg-blue-100 text-blue-800 animate-pulse",
      label: labels.running,
    },
  };
  const entry = map[status] ?? { className: "bg-surface text-muted-foreground", label: status };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}
