import "server-only";
import { eq } from "drizzle-orm";
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
  patch: { audioUrl?: string | null; durationSeconds?: number }
): Promise<void> {
  await db
    .update(sessions)
    .set({
      status: "completed",
      endedAt: new Date(),
      audioUrl: patch.audioUrl ?? null,
      durationSeconds: patch.durationSeconds ?? null,
    })
    .where(eq(sessions.id, id));
}

export async function markSessionAborted(id: string): Promise<void> {
  await db
    .update(sessions)
    .set({ status: "aborted", endedAt: new Date() })
    .where(eq(sessions.id, id));
}
