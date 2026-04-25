import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getRole } from "@/lib/role";
import {
  loadProgressByRole,
  COMPLETION_THRESHOLD,
} from "@/lib/module-progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const role = await getRole();
  const progress = await loadProgressByRole(role);
  return Response.json({ progress });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response("Bad request", { status: 400 });
  }
  const driveFileId = (body as { driveFileId?: unknown }).driveFileId;
  const watchedSecondsRaw = (body as { watchedSeconds?: unknown }).watchedSeconds;
  const durationSecondsRaw = (body as { durationSeconds?: unknown })
    .durationSeconds;

  if (typeof driveFileId !== "string" || driveFileId.length === 0) {
    return new Response("driveFileId required", { status: 400 });
  }
  if (typeof watchedSecondsRaw !== "number" || !Number.isFinite(watchedSecondsRaw)) {
    return new Response("watchedSeconds required", { status: 400 });
  }

  const role = await getRole();
  const watched = Math.max(0, Math.floor(watchedSecondsRaw));
  const duration =
    typeof durationSecondsRaw === "number" &&
    Number.isFinite(durationSecondsRaw) &&
    durationSecondsRaw > 0
      ? Math.floor(durationSecondsRaw)
      : null;

  const completed =
    duration != null && watched / duration >= COMPLETION_THRESHOLD;

  await db.execute(sql`
    INSERT INTO module_progress (
      role, drive_file_id, watched_seconds, duration_seconds, completed_at, updated_at
    ) VALUES (
      ${role},
      ${driveFileId},
      ${watched},
      ${duration},
      ${completed ? sql`now()` : null},
      now()
    )
    ON CONFLICT (role, drive_file_id) DO UPDATE SET
      watched_seconds = GREATEST(module_progress.watched_seconds, EXCLUDED.watched_seconds),
      duration_seconds = COALESCE(EXCLUDED.duration_seconds, module_progress.duration_seconds),
      completed_at = COALESCE(module_progress.completed_at, EXCLUDED.completed_at),
      updated_at = now()
  `);

  return Response.json({ ok: true, completed });
}
