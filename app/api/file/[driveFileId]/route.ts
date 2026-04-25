import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getDriveClient } from "@/lib/drive/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
};

const INLINE_EXTENSIONS = new Set([".pdf"]);

function describe(filename: string | null): {
  mime: string;
  inline: boolean;
  basename: string;
} {
  const safeName = filename ?? "fichier";
  const ext = path.extname(safeName).toLowerCase();
  return {
    mime: MIME_BY_EXT[ext] ?? "application/octet-stream",
    inline: INLINE_EXTENSIONS.has(ext),
    basename: safeName,
  };
}

type ChunkMetaRow = {
  metadata: unknown;
  source_file: string;
};

async function findLocalRow(
  driveFileId: string
): Promise<{ absolutePath: string; sourceFile: string } | null> {
  const rows = await db.execute<ChunkMetaRow>(sql`
    SELECT metadata, source_file
    FROM knowledge_chunks
    WHERE drive_file_id = ${driveFileId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  const meta = row.metadata as Record<string, unknown> | null;
  if (!meta) return null;
  const p = meta.absolutePath;
  if (typeof p !== "string" || p.length === 0) return null;
  return { absolutePath: p, sourceFile: row.source_file };
}

async function findSourceFileFor(
  driveFileId: string
): Promise<string | null> {
  const rows = await db.execute<{ source_file: string }>(sql`
    SELECT source_file FROM knowledge_chunks
    WHERE drive_file_id = ${driveFileId}
    LIMIT 1
  `);
  return rows[0]?.source_file ?? null;
}

function dispositionHeader(name: string, inline: boolean): string {
  const safe = name.replace(/[\r\n"]/g, "");
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_");
  const utf8 = encodeURIComponent(safe);
  const disposition = inline ? "inline" : "attachment";
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ driveFileId: string }> }
) {
  const { driveFileId } = await params;

  if (driveFileId.startsWith("local:")) {
    const found = await findLocalRow(driveFileId);
    if (!found) return new Response("Not indexed", { status: 404 });

    let s;
    try {
      s = await stat(found.absolutePath);
    } catch {
      return new Response("Source file missing on disk", { status: 410 });
    }

    const meta = describe(found.sourceFile || found.absolutePath);
    const stream = createReadStream(found.absolutePath);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        "Content-Type": meta.mime,
        "Content-Length": String(s.size),
        "Content-Disposition": dispositionHeader(meta.basename, meta.inline),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (!/^[\w-]+$/.test(driveFileId)) {
    return new Response("Invalid driveFileId", { status: 400 });
  }

  const sourceFile = await findSourceFileFor(driveFileId);
  const meta = describe(sourceFile);
  const drive = getDriveClient();

  let driveResp;
  try {
    driveResp = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      { responseType: "stream" }
    );
  } catch (e) {
    console.error("file proxy: drive fetch failed", driveFileId, e);
    return new Response("Upstream error", { status: 502 });
  }

  const inputStream = driveResp.data as unknown as Readable;
  const headers = new Headers();
  headers.set("Content-Type", meta.mime);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set(
    "Content-Disposition",
    dispositionHeader(meta.basename, meta.inline)
  );
  const driveHeaders = driveResp.headers as Record<string, string | undefined>;
  const cl = driveHeaders["content-length"];
  if (cl) headers.set("Content-Length", cl);

  return new Response(
    Readable.toWeb(inputStream) as ReadableStream<Uint8Array>,
    { status: 200, headers }
  );
}
