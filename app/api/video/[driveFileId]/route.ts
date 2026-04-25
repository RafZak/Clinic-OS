import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { getDriveClient } from "@/lib/drive/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ driveFileId: string }> }
) {
  const { driveFileId } = await params;
  if (!/^[\w-]+$/.test(driveFileId)) {
    return new Response("Invalid driveFileId", { status: 400 });
  }

  const drive = getDriveClient();

  const meta = await drive.files
    .get({ fileId: driveFileId, fields: "size, mimeType, name" })
    .catch(() => null);
  if (!meta?.data) {
    return new Response("Not found", { status: 404 });
  }
  const size = parseInt(meta.data.size ?? "0", 10);
  const mimeType = meta.data.mimeType ?? "video/mp4";
  const range = req.headers.get("range");

  const driveResp = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    {
      responseType: "stream",
      headers: range ? { Range: range } : undefined,
    }
  );

  const nodeStream = driveResp.data as unknown as Readable;
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  const respHeaders = new Headers();
  respHeaders.set("Content-Type", mimeType);
  respHeaders.set("Accept-Ranges", "bytes");
  respHeaders.set("Cache-Control", "private, max-age=3600");

  const driveHeaders = driveResp.headers as Record<string, string | undefined>;
  const contentRange = driveHeaders["content-range"];
  const contentLength = driveHeaders["content-length"];

  if (contentRange) {
    respHeaders.set("Content-Range", contentRange);
  }
  if (contentLength) {
    respHeaders.set("Content-Length", contentLength);
  } else if (!range && size > 0) {
    respHeaders.set("Content-Length", String(size));
  }

  return new Response(webStream, {
    status: range ? 206 : 200,
    headers: respHeaders,
  });
}
