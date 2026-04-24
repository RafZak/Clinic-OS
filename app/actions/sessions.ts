"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  patients,
  sessionScores,
  coachingInsights,
} from "@/db/schema";
import { insertSession, markSessionCompleted, markSessionAborted } from "@/lib/sessions";
import type { SessionKind } from "@/lib/sessions";
import { getSiteUrl } from "@/lib/site-url";
import { getScenarioBySlug } from "@/scripts/replay/scripts";

export async function startLiveSession(kind: SessionKind): Promise<void> {
  const id = await insertSession({ kind, source: "live" });
  const route = kind === "consultation" ? `/consultations/${id}` : `/appels/${id}`;
  redirect(route);
}

export async function finishLiveSession(
  id: string,
  patch: { audioUrl?: string | null; durationSeconds: number }
): Promise<{ ok: true }> {
  await markSessionCompleted(id, patch);
  kickAnalysis(id);
  return { ok: true };
}

export async function abortLiveSession(id: string): Promise<{ ok: true }> {
  await markSessionAborted(id);
  return { ok: true };
}

export async function retryAnalysis(id: string): Promise<{ ok: true }> {
  kickAnalysis(id);
  return { ok: true };
}

export async function startReplaySession(slug: string): Promise<void> {
  const scenario = getScenarioBySlug(slug);
  if (!scenario) throw new Error(`Scénario inconnu: ${slug}`);

  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.label, scenario.patientLabel))
    .limit(1);
  if (!patient) {
    throw new Error(
      `Patient "${scenario.patientLabel}" non seedé. Lancez pnpm seed:replay.`
    );
  }

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.source, "replay"), eq(sessions.patientId, patient.id)))
    .limit(1);
  if (!session) {
    throw new Error(
      `Session replay "${slug}" non seedée. Lancez pnpm seed:replay.`
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(sessionScores).where(eq(sessionScores.sessionId, session.id));
    await tx
      .delete(coachingInsights)
      .where(eq(coachingInsights.sessionId, session.id));
    await tx
      .update(sessions)
      .set({
        status: "in_progress",
        analysisStatus: "pending",
        analysisError: null,
        analyzedAt: null,
        globalScore: null,
        summary: null,
        endedAt: null,
      })
      .where(eq(sessions.id, session.id));
  });

  redirect(`/consultations/${session.id}`);
}

function kickAnalysis(id: string): void {
  after(async () => {
    try {
      const res = await fetch(`${getSiteUrl()}/api/sessions/${id}/retranscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        console.warn(`retranscribe kick non-OK for ${id}: ${res.status}`);
      }
    } catch (err) {
      console.warn(`retranscribe kick failed for ${id}`, err);
    }
  });
}
