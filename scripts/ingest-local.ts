import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import postgres from "postgres";
import * as schema from "../db/schema";
import { chunkByTokens } from "../lib/ingest/chunk";
import { embedTexts } from "../lib/ingest/embed";
import {
  buildChunkRows,
  replaceChunksForFile,
  type IngestChunkRow,
} from "../lib/ingest/upsert";
import type { ExtractedDocument } from "../lib/drive/extract";

config({ path: ".env.local" });

type CliOpts = {
  filePath: string;
  programSlug: string;
  moduleNumber?: number;
  force: boolean;
};

function parseArgs(): CliOpts {
  const argv = process.argv.slice(2);
  let filePath: string | null = null;
  let programSlug: string | null = null;
  let moduleNumber: number | undefined;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") filePath = argv[++i];
    else if (a === "--program" || a === "-p") programSlug = argv[++i];
    else if (a === "--module-number" || a === "-m")
      moduleNumber = parseInt(argv[++i], 10);
    else if (a === "--force") force = true;
    else if (!a.startsWith("-") && !filePath) filePath = a;
  }

  if (!filePath) {
    throw new Error(
      "Usage : pnpm ingest:local <file> --program <slug> [--module-number N]"
    );
  }
  if (!programSlug) {
    throw new Error("--program <slug> requis (ex. reference, audio-vente)");
  }
  return {
    filePath: resolve(filePath),
    programSlug,
    moduleNumber,
    force,
  };
}

async function extractLocal(filePath: string): Promise<ExtractedDocument> {
  const buf = await readFile(filePath);
  const name = basename(filePath).toLowerCase();

  if (name.endsWith(".pdf")) {
    const parsed = await pdfParse(buf);
    const texts = chunkByTokens(parsed.text, {
      targetTokens: 300,
      maxTokens: 450,
      overlapTokens: 60,
    });
    return {
      sourceType: "pdf",
      chunks: texts.map((text, i) => ({
        text,
        chunkIndex: i,
        metadata: { pages: parsed.numpages },
      })),
    };
  }

  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const texts = chunkByTokens(value, {
      targetTokens: 300,
      maxTokens: 450,
      overlapTokens: 60,
    });
    return {
      sourceType: "docx",
      chunks: texts.map((text, i) => ({ text, chunkIndex: i })),
    };
  }

  throw new Error(
    `Extension non supportée : ${name}. Fichiers locaux acceptés : .pdf, .docx`
  );
}

function stableLocalId(filePath: string, mtimeMs: number, size: number): string {
  const hash = createHash("sha1")
    .update(`${filePath}|${mtimeMs}|${size}`)
    .digest("hex")
    .slice(0, 16);
  return `local:${hash}`;
}

async function main() {
  const opts = parseArgs();
  const meta = await stat(opts.filePath);

  const driveFileId = stableLocalId(opts.filePath, meta.mtimeMs, meta.size);
  const sourceFile = basename(opts.filePath);

  console.log(`→ Fichier : ${sourceFile} (${(meta.size / 1024).toFixed(1)} Ko)`);
  console.log(`  Programme : ${opts.programSlug}`);
  if (opts.moduleNumber) console.log(`  Module : ${opts.moduleNumber}`);
  console.log(`  ID : ${driveFileId}`);

  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    if (!opts.force) {
      const existing = await db
        .select({ modifiedAt: schema.knowledgeChunks.driveModifiedAt })
        .from(schema.knowledgeChunks)
        .where(eq(schema.knowledgeChunks.driveFileId, driveFileId))
        .limit(1);
      if (
        existing[0]?.modifiedAt &&
        existing[0].modifiedAt.getTime() === meta.mtime.getTime()
      ) {
        console.log("  ⊖ skip (déjà à jour, --force pour forcer)");
        await client.end();
        return;
      }
    }

    console.log("→ Extraction + chunking");
    const doc = await extractLocal(opts.filePath);
    if (doc.chunks.length === 0) {
      console.log("  ⊘ aucun chunk (fichier vide)");
      await client.end();
      return;
    }
    console.log(`  ${doc.chunks.length} chunk(s)`);

    console.log("→ Embeddings Voyage");
    const embeddings = await embedTexts(
      doc.chunks.map((c) => c.text),
      "document"
    );

    console.log("→ Upsert en DB");
    const rows: IngestChunkRow[] = buildChunkRows(doc, {
      sourceFile,
      programSlug: opts.programSlug,
      moduleNumber: opts.moduleNumber,
      driveFileId,
      driveModifiedAt: meta.mtime,
      embeddings,
      extraMeta: {
        origin: "local-upload",
        absolutePath: opts.filePath,
        sizeBytes: meta.size,
      },
    });
    await replaceChunksForFile(db, driveFileId, rows);

    console.log(`\n✓ ${rows.length} chunks upsertés pour "${sourceFile}"`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
