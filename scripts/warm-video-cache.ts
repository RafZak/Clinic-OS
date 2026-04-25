import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const VIDEO_CACHE_DIR = path.join(os.tmpdir(), "clinic-os-video-cache");

async function main() {
  const baseUrl = process.env.WARM_BASE_URL ?? "http://localhost:3000";
  const dbUrl = process.env.DATABASE_URL!;
  const client = postgres(dbUrl, { max: 1 });
  const db = drizzle(client);

  const rows = await db.execute<{
    drive_file_id: string;
    source_file: string;
  }>(sql`
    SELECT DISTINCT drive_file_id, source_file
    FROM knowledge_chunks
    WHERE source_type = 'video_transcript'
      AND drive_file_id IS NOT NULL
    ORDER BY source_file
  `);
  await client.end();

  console.log(`Warming ${rows.length} videos via ${baseUrl}`);
  console.log(`Cache dir: ${VIDEO_CACHE_DIR}`);
  console.log("");

  for (const r of rows) {
    const cachePath = path.join(VIDEO_CACHE_DIR, `${r.drive_file_id}.mp4`);
    process.stdout.write(`  ${r.source_file.slice(0, 50).padEnd(52)} `);

    try {
      const cached = await stat(cachePath).catch(() => null);
      if (cached && cached.size > 0) {
        console.log(`✓ déjà en cache (${formatBytes(cached.size)})`);
        continue;
      }

      const t0 = Date.now();
      const resp = await fetch(`${baseUrl}/api/video/${r.drive_file_id}`, {
        headers: { Range: "bytes=0-1023" },
      });
      await resp.body?.cancel();
      const dt = Math.round((Date.now() - t0) / 1000);

      if (resp.ok) {
        const after = await stat(cachePath).catch(() => null);
        const size = after ? formatBytes(after.size) : "?";
        console.log(`✓ ${resp.status} en ${dt}s (${size})`);
      } else {
        console.log(`✗ HTTP ${resp.status}`);
      }
    } catch (e) {
      console.log(`✗ ${(e as Error).message}`);
    }
  }

  console.log("");
  console.log("Done.");
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
