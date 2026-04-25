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

type ChunkMetaRow = {
  metadata: unknown;
  source_file: string;
};

async function findLocalPath(
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ driveFileId: string }> }
) {
  const { driveFileId } = await params;

  if (driveFileId.startsWith("local:")) {
    const found = await findLocalPath(driveFileId);
    if (!found) return new Response("Not indexed", { status: 404 });

    let s;
    try {
      s = await stat(found.absolutePath);
    } catch {
      return new Response("Source file missing on disk", { status: 410 });
    }

    const stream = createReadStream(found.absolutePath);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(s.size),
        "Content-Disposition": `inline; filename="${path.basename(found.absolutePath)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (!/^[\w-]+$/.test(driveFileId)) {
    return new Response("Invalid driveFileId", { status: 400 });
  }

  const sourceFile = await findSourceFileFor(driveFileId);
  const drive = getDriveClient();

  let driveResp;
  try {
    driveResp = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      { responseType: "stream" }
    );
  } catch (e) {
    console.error("pdf proxy: drive fetch failed", driveFileId, e);
    return new Response("Upstream error", { status: 502 });
  }

  const inputStream = driveResp.data as unknown as Readable;
  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Cache-Control", "private, max-age=3600");
  if (sourceFile) {
    headers.set(
      "Content-Disposition",
      `inline; filename="${sourceFile.replace(/[\r\n"]/g, "")}"`
    );
  }
  const driveHeaders = driveResp.headers as Record<string, string | undefined>;
  const cl = driveHeaders["content-length"];
  if (cl) headers.set("Content-Length", cl);

  return new Response(
    Readable.toWeb(inputStream) as ReadableStream<Uint8Array>,
    { status: 200, headers }
  );
}
