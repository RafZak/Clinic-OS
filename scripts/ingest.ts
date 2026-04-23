import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { getDriveClient, getKnowledgeFolderId } from "../lib/drive/client";
import {
  classifyFile,
  collectFiles,
  dedupeVideos,
  type DriveFile,
  type FileKind,
} from "../lib/drive/crawler";
import {
  extractDocx,
  extractPdf,
  extractVideo,
  type ExtractedDocument,
} from "../lib/drive/extract";
import { embedTexts } from "../lib/ingest/embed";
import {
  buildChunkRows,
  existingChunkMeta,
  replaceChunksForFile,
} from "../lib/ingest/upsert";

config({ path: ".env.local" });

type CliOpts = {
  pdfsOnly: boolean;
  videosOnly: boolean;
  docxOnly: boolean;
  force: boolean;
  limit: number | null;
  program: string | null;
};

function parseArgs(): CliOpts {
  const argv = process.argv.slice(2);
  const opts: CliOpts = {
    pdfsOnly: false,
    videosOnly: false,
    docxOnly: false,
    force: false,
    limit: null,
    program: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pdfs-only") opts.pdfsOnly = true;
    else if (a === "--videos-only") opts.videosOnly = true;
    else if (a === "--docx-only") opts.docxOnly = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--limit") opts.limit = parseInt(argv[++i] ?? "0", 10);
    else if (a === "--program") opts.program = argv[++i] ?? null;
  }
  return opts;
}

function shouldProcess(kind: FileKind, opts: CliOpts): boolean {
  if (kind === "unknown") return false;
  if (opts.pdfsOnly) return kind === "pdf";
  if (opts.videosOnly) return kind === "video";
  if (opts.docxOnly) return kind === "docx";
  return true;
}

type PgErr = {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  constraint_name?: string;
  column_name?: string;
  where?: string;
};

function formatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const root = err as Error & { cause?: unknown };
  // Drizzle wraps postgres-js errors; the root cause carries code/detail.
  const pg = (root.cause ?? root) as PgErr;
  const firstLine = (pg.message ?? root.message ?? "").split("\n")[0].slice(0, 300);
  const parts = [firstLine];
  if (pg.code) parts.push(`code=${pg.code}`);
  if (pg.detail) parts.push(`detail=${pg.detail.slice(0, 300)}`);
  if (pg.hint) parts.push(`hint=${pg.hint}`);
  if (pg.constraint_name) parts.push(`constraint=${pg.constraint_name}`);
  if (pg.column_name) parts.push(`column=${pg.column_name}`);
  if (pg.where) parts.push(`where=${pg.where.slice(0, 150)}`);
  return parts.join(" | ");
}

async function main() {
  const opts = parseArgs();
  console.log("Options :", opts);

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");
  const client = postgres(process.env.DATABASE_URL, { max: 2 });
  const db = drizzle(client, { schema });

  const drive = getDriveClient();
  const rootId = getKnowledgeFolderId();

  // Ouvrir une ligne ingestion_runs
  const [run] = await db
    .insert(schema.ingestionRuns)
    .values({ status: "running", triggeredBy: "manual" })
    .returning({ id: schema.ingestionRuns.id });
  const runId = run.id;
  console.log(`\n→ Ingestion run : ${runId}\n`);

  // 1) Collecter les fichiers Drive
  console.log("→ Lecture du Drive…");
  const rawFiles = await collectFiles(drive, rootId);
  const files = dedupeVideos(rawFiles).filter((f) => {
    if (opts.program && f.programSlug !== opts.program) return false;
    return shouldProcess(classifyFile(f), opts);
  });
  const limited = opts.limit ? files.slice(0, opts.limit) : files;
  console.log(`  ${limited.length} fichier(s) à traiter\n`);

  let processed = 0;
  let skipped = 0;
  let chunksCreated = 0;
  const errors: { file: string; error: string }[] = [];

  for (const [idx, file] of limited.entries()) {
    const kind = classifyFile(file);
    const driveModifiedAt = new Date(file.modifiedTime);
    const label = `[${idx + 1}/${limited.length}] ${file.programSlug}/${file.name}`;

    try {
      // Idempotence
      if (!opts.force) {
        const meta = await existingChunkMeta(db, file.id);
        if (
          meta.count > 0 &&
          meta.modifiedAt &&
          meta.modifiedAt.getTime() === driveModifiedAt.getTime()
        ) {
          console.log(`  ⊖ skip (déjà à jour) ${label}`);
          skipped++;
          continue;
        }
      }

      console.log(`  → ${kind.padEnd(5)} ${label}`);

      let doc: ExtractedDocument;
      if (kind === "pdf") doc = await extractPdf(drive, file);
      else if (kind === "docx") doc = await extractDocx(drive, file);
      else if (kind === "video") doc = await extractVideo(drive, file);
      else continue;

      if (doc.chunks.length === 0) {
        console.log(`    ⊘ aucun chunk produit (fichier vide ou illisible)`);
        skipped++;
        continue;
      }

      const embeddings = await embedTexts(
        doc.chunks.map((c) => c.text),
        "document"
      );
      const rows = buildChunkRows(doc, {
        sourceFile: file.name,
        programSlug: file.programSlug,
        moduleNumber: file.moduleNumber,
        driveFileId: file.id,
        driveModifiedAt,
        embeddings,
        extraMeta: {
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          driveFolderPath: file.driveFolderPath,
        },
      });
      await replaceChunksForFile(db, file.id, rows);

      chunksCreated += rows.length;
      processed++;
      console.log(`    ✓ ${rows.length} chunks`);
    } catch (err) {
      const msg = formatError(err);
      console.error(`    ✗ ${msg}`);
      if (process.env.INGEST_DEBUG) {
        console.error("    DEBUG err keys:", Object.keys(err as object));
        console.error(
          "    DEBUG err:",
          JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2).slice(0, 2000)
        );
      }
      errors.push({ file: file.name, error: msg });
    }
  }

  // Clôturer la run
  const status = errors.length === 0 ? "success" : processed > 0 ? "partial" : "failed";
  await db
    .update(schema.ingestionRuns)
    .set({
      endedAt: new Date(),
      status,
      filesProcessed: processed,
      chunksCreated,
      errors: errors.length ? errors : null,
    })
    .where(eq(schema.ingestionRuns.id, runId));

  console.log("\n─────────────────────────────────");
  console.log(
    `✓ Terminé : ${processed} traités · ${skipped} skippés · ${chunksCreated} chunks · ${errors.length} erreur(s)`
  );
  if (errors.length) {
    console.log("Erreurs :");
    errors.forEach((e) => console.log(`  - ${e.file} : ${e.error}`));
  }
  console.log(`Run : ${runId} [${status}]`);

  await client.end();
}

main().catch((err) => {
  console.error("\n✗ Ingestion échouée :", err);
  process.exit(1);
});
