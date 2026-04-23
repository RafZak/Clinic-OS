import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Mic, Sheet } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";
import { getProgramBySlug } from "@/lib/programs";

export const dynamic = "force-dynamic";

type ChunkFile = {
  drive_file_id: string;
  source_file: string;
  source_type: "pdf" | "docx" | "video_transcript";
  module_number: number | null;
  chunks: number;
};

const TYPE_ICON = {
  pdf: FileText,
  docx: Sheet,
  video_transcript: Mic,
} as const;

const TYPE_LABEL = {
  pdf: "PDF",
  docx: "DOCX",
  video_transcript: "Vidéo",
} as const;

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) notFound();

  const files = await db.execute<ChunkFile>(sql`
    SELECT
      drive_file_id,
      source_file,
      source_type::text as source_type,
      module_number,
      count(*)::int as chunks
    FROM knowledge_chunks
    WHERE program_slug = ${slug}
    GROUP BY drive_file_id, source_file, source_type, module_number
    ORDER BY module_number NULLS FIRST, source_file
  `);

  const byType = {
    pdf: files.filter((f) => f.source_type === "pdf"),
    docx: files.filter((f) => f.source_type === "docx"),
    video_transcript: files.filter((f) => f.source_type === "video_transcript"),
  };

  const totalChunks = files.reduce((sum, f) => sum + f.chunks, 0);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/catalogue"
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Catalogue
      </Link>

      <PageHeader
        title={program.title}
        description={program.description}
        actions={
          program.isAvailable ? (
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand">
              Actif
            </span>
          ) : (
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bientôt disponible
            </span>
          )
        }
      />

      {!program.isAvailable ? (
        <PlaceholderBlock>
          Ce programme sera ajouté à une prochaine itération. Pas d'ingestion pour l'instant.
        </PlaceholderBlock>
      ) : files.length === 0 ? (
        <PlaceholderBlock>
          Aucun fichier ingéré pour ce programme. Lance{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5">
            pnpm ingest --program {slug}
          </code>
          .
        </PlaceholderBlock>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Fichiers" value={files.length.toString()} />
            <Stat label="Chunks" value={totalChunks.toLocaleString("fr-FR")} />
            <Stat
              label="Vidéos transcrites"
              value={byType.video_transcript.length.toString()}
            />
          </div>

          {(["pdf", "video_transcript", "docx"] as const).map((type) => {
            const list = byType[type];
            if (list.length === 0) return null;
            const Icon = TYPE_ICON[type];
            return (
              <section key={type} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between border-b border-border pb-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {TYPE_LABEL[type]}
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {list.length} fichier{list.length > 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
                  {list.map((f) => (
                    <li
                      key={f.drive_file_id}
                      className="grid grid-cols-[1fr,auto,auto] items-center gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="truncate font-medium text-ink">
                        {f.source_file}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {f.module_number ? `module ${f.module_number}` : "—"}
                      </span>
                      <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                        {f.chunks} chunk{f.chunks > 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
