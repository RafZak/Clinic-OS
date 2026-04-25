import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Role } from "@/lib/role";

export type ModuleProgressEntry = {
  driveFileId: string;
  watchedSeconds: number;
  durationSeconds: number | null;
  completedAt: Date | null;
};

type RawRow = {
  drive_file_id: string;
  watched_seconds: number;
  duration_seconds: number | null;
  completed_at: string | null;
};

export async function loadProgressByRole(
  role: Role
): Promise<ModuleProgressEntry[]> {
  const rows = await db.execute<RawRow>(sql`
    SELECT drive_file_id, watched_seconds, duration_seconds, completed_at
    FROM module_progress
    WHERE role = ${role}
  `);
  return rows.map((r) => ({
    driveFileId: r.drive_file_id,
    watchedSeconds: r.watched_seconds,
    durationSeconds: r.duration_seconds,
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
  }));
}

export async function loadProgressMap(
  role: Role
): Promise<Map<string, ModuleProgressEntry>> {
  const list = await loadProgressByRole(role);
  return new Map(list.map((p) => [p.driveFileId, p]));
}

export const COMPLETION_THRESHOLD = 0.9;
