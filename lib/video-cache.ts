import { Readable } from "node:stream";
import { createWriteStream, promises as fs } from "node:fs";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDriveClient } from "@/lib/drive/client";

export const VIDEO_CACHE_DIR = path.join(os.tmpdir(), "clinic-os-video-cache");

const inflight = new Map<string, Promise<string>>();

function cachePath(driveFileId: string): string {
  return path.join(VIDEO_CACHE_DIR, `${driveFileId}.mp4`);
}

async function downloadToCache(driveFileId: string): Promise<string> {
  const finalPath = cachePath(driveFileId);
  await fs.mkdir(VIDEO_CACHE_DIR, { recursive: true });
  const tmpPath = `${finalPath}.partial-${process.pid}-${Date.now()}`;

  const drive = getDriveClient();
  const driveResp = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "stream" }
  );
  const inputStream = driveResp.data as unknown as Readable;
  const writeStream = createWriteStream(tmpPath);

  await new Promise<void>((resolve, reject) => {
    inputStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", () => resolve());
    inputStream.pipe(writeStream);
  });

  await fs.rename(tmpPath, finalPath);
  return finalPath;
}

export async function ensureVideoCached(driveFileId: string): Promise<string> {
  const finalPath = cachePath(driveFileId);
  try {
    const s = await stat(finalPath);
    if (s.size > 0) return finalPath;
  } catch {}

  let pending = inflight.get(driveFileId);
  if (!pending) {
    pending = downloadToCache(driveFileId).finally(() => {
      inflight.delete(driveFileId);
    });
    inflight.set(driveFileId, pending);
  }
  return pending;
}

export async function isVideoCached(driveFileId: string): Promise<boolean> {
  try {
    const s = await stat(cachePath(driveFileId));
    return s.size > 0;
  } catch {
    return false;
  }
}
