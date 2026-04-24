import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";

export type SessionKind = "consultation" | "phone_call";
export type SessionStatus = "in_progress" | "completed" | "aborted";

export type SessionRow = typeof sessions.$inferSelect;

export async function getSessionById(id: string): Promise<SessionRow | null> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return row ?? null;
}

export async function insertSession(input: { kind: SessionKind; source: "live" | "replay" | "seed" }): Promise<string> {
  const [row] = await db
    .insert(sessions)
    .values({ kind: input.kind, source: input.source, status: "in_progress" })
    .returning({ id: sessions.id });
  return row.id;
}

export async function markSessionCompleted(
  id: string,
  patch: { audioUrl?: string | null; durationSeconds: number }
): Promise<void> {
  const set: Partial<typeof sessions.$inferInsert> = {
    status: "completed",
    endedAt: new Date(),
    durationSeconds: patch.durationSeconds,
  };
  if ("audioUrl" in patch) set.audioUrl = patch.audioUrl ?? null;
  await db
    .update(sessions)
    .set(set)
    .where(and(eq(sessions.id, id), eq(sessions.status, "in_progress")));
}

export async function markSessionAborted(id: string): Promise<void> {
  await db
    .update(sessions)
    .set({ status: "aborted", endedAt: new Date() })
    .where(and(eq(sessions.id, id), eq(sessions.status, "in_progress")));
}
