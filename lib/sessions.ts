import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientEvents, sessions } from "@/db/schema";

export type SessionKind = "consultation" | "phone_call";
export type SessionStatus = "in_progress" | "completed" | "aborted";

export type SessionRow = typeof sessions.$inferSelect;

export async function getSessionById(id: string): Promise<SessionRow | null> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return row ?? null;
}

export async function insertSession(input: {
  kind: SessionKind;
  source: "live" | "replay" | "seed";
  patientId?: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(sessions)
    .values({
      kind: input.kind,
      source: input.source,
      status: "in_progress",
      patientId: input.patientId ?? null,
    })
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
  const updated = await db
    .update(sessions)
    .set(set)
    .where(and(eq(sessions.id, id), eq(sessions.status, "in_progress")))
    .returning({
      id: sessions.id,
      kind: sessions.kind,
      patientId: sessions.patientId,
      startedAt: sessions.startedAt,
    });
  const row = updated[0];
  if (!row || !row.patientId) return;
  if (row.kind !== "consultation" && row.kind !== "phone_call") return;
  await ensurePatientEventForSession({
    sessionId: row.id,
    kind: row.kind,
    patientId: row.patientId,
    occurredAt: row.startedAt ?? new Date(),
  });
}

async function ensurePatientEventForSession(input: {
  sessionId: string;
  kind: SessionKind;
  patientId: string;
  occurredAt: Date;
}): Promise<void> {
  const existing = await db
    .select({ id: patientEvents.id })
    .from(patientEvents)
    .where(eq(patientEvents.sessionId, input.sessionId))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(patientEvents).values({
    patientId: input.patientId,
    kind: input.kind,
    sessionId: input.sessionId,
    occurredAt: input.occurredAt,
  });
}

export async function markSessionAborted(id: string): Promise<void> {
  await db
    .update(sessions)
    .set({ status: "aborted", endedAt: new Date() })
    .where(and(eq(sessions.id, id), eq(sessions.status, "in_progress")));
}
