"use server";

import { redirect } from "next/navigation";
import { insertSession, markSessionCompleted, markSessionAborted } from "@/lib/sessions";
import type { SessionKind } from "@/lib/sessions";

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
  return { ok: true };
}

export async function abortLiveSession(id: string): Promise<{ ok: true }> {
  await markSessionAborted(id);
  return { ok: true };
}
