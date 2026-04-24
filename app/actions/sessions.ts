"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { insertSession, markSessionCompleted, markSessionAborted } from "@/lib/sessions";
import type { SessionKind } from "@/lib/sessions";
import { getSiteUrl } from "@/lib/site-url";

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
