import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { getDriveClient } from "@/lib/drive/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ driveFileId: string }> }
) {
  const { driveFileId } = await params;
  if (!/^[\w-]+$/.test(driveFileId)) {
    return new Response("Invalid driveFileId", { status: 400 });
  }

  const range = req.headers.get("range") ?? undefined;
  const drive = getDriveClient();

  let driveResp;
  try {
    driveResp = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      {
        responseType: "stream",
        headers: range ? { Range: range } : undefined,
      }
    );
  } catch (e) {
    console.error("video proxy: drive fetch failed", driveFileId, e);
    return new Response("Upstream error", { status: 502 });
  }

  const inputStream = driveResp.data as unknown as Readable;
  const driveHeaders = driveResp.headers as Record<string, string | undefined>;

  const headers = new Headers();
  headers.set("Content-Type", "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");

  const cl = driveHeaders["content-length"];
  if (cl) headers.set("Content-Length", cl);

  const cr = driveHeaders["content-range"];
  if (cr) headers.set("Content-Range", cr);

  const status = range && cr ? 206 : 200;

  return new Response(
    Readable.toWeb(inputStream) as ReadableStream<Uint8Array>,
    { status, headers }
  );
}
