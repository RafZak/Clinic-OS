import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ingestionRuns, knowledgeChunks, programs } from "@/db/schema";
import { PageHeader } from "@/components/layout/page-header";
import { RetrievalTest } from "@/components/admin/retrieval-test";

export const dynamic = "force-dynamic";

export default async function AdminKnowledgePage() {
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
      <PageHeader
        title="Admin — Knowledge Layer A"
        description="Pipeline d'ingestion Google Drive, chunks vectoriels pgvector, test de retrieval et historique des runs."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Chunks totaux" value={totalChunks.toLocaleString("fr-FR")} />
        <Kpi
          label="PDF"
          value={
            (perType.find((p) => p.source_type === "pdf")?.chunks ?? 0).toLocaleString("fr-FR")
          }
        />
        <Kpi
          label="Vidéos"
          value={
            (
              perType.find((p) => p.source_type === "video_transcript")?.chunks ?? 0
            ).toLocaleString("fr-FR")
          }
        />
        <Kpi
          label="DOCX"
          value={
            (perType.find((p) => p.source_type === "docx")?.chunks ?? 0).toLocaleString("fr-FR")
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-base font-semibold">Volume par programme</h2>
            <p className="text-xs text-muted-foreground">
              Une ligne par programme actif. Les programmes sans données n'ont pas été
              ingérés (ou le programme n'est pas un programme actif côté métier).
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
                      slug : {p.slug} · {files} fichier{files > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                    {chunks.toLocaleString("fr-FR")} chunks
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
            <h2 className="text-base font-semibold">Derniers runs d'ingestion</h2>
            <p className="text-xs text-muted-foreground">
              Déclencher depuis le CLI : <code className="rounded bg-surface-muted px-1 py-0.5">pnpm ingest</code>.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {recentRuns.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucun run enregistré.</p>
            )}
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] text-ink">
                    {run.startedAt?.toISOString().replace("T", " ").slice(0, 19)}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {run.filesProcessed ?? 0} fichiers · {run.chunksCreated ?? 0} chunks
                  </p>
                </div>
                <StatusPill status={run.status ?? "running"} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <RetrievalTest />
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    failed: "bg-red-100 text-red-800",
    running: "bg-blue-100 text-blue-800 animate-pulse",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        map[status] ?? "bg-surface text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
