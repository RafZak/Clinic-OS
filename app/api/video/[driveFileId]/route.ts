import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { ensureVideoCached } from "@/lib/video-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rangeError(total: number): Response {
  return new Response("Out of range", {
    status: 416,
    headers: { "Content-Range": `bytes */${total}` },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ driveFileId: string }> }
) {
  const { driveFileId } = await params;
  if (!/^[\w-]+$/.test(driveFileId)) {
    return new Response("Invalid driveFileId", { status: 400 });
  }

  let cachePath: string;
  try {
    cachePath = await ensureVideoCached(driveFileId);
  } catch (e) {
    console.error("video proxy: download failed", driveFileId, e);
    return new Response("Upstream error", { status: 502 });
  }

  const fileStat = await stat(cachePath);
  const total = fileStat.size;
  const mimeType = "video/mp4";
  const range = req.headers.get("range");

  if (!range) {
    const stream = createReadStream(cachePath);
    return new Response(
      Readable.toWeb(stream) as ReadableStream<Uint8Array>,
      {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(total),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      }
    );
  }

  const m = range.match(/^bytes=(\d+)-(\d*)$/);
  if (!m) return rangeError(total);
  const start = parseInt(m[1], 10);
  const end = m[2] ? parseInt(m[2], 10) : total - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
    return rangeError(total);
  }
  const realEnd = Math.min(end, total - 1);
  const chunkSize = realEnd - start + 1;
  const stream = createReadStream(cachePath, { start, end: realEnd });

  return new Response(
    Readable.toWeb(stream) as ReadableStream<Uint8Array>,
    {
      status: 206,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${realEnd}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    }
  );
}
