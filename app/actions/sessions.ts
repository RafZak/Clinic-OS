"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, asc, eq, ilike } from "drizzle-orm";
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
import { getPhoneScenarioBySlug } from "@/scripts/replay/scripts-phone";

export type PatientSummary = {
  id: string;
  label: string;
  status: "prospect" | "patient" | "lost";
};

export async function listPatientsLite(): Promise<PatientSummary[]> {
  const rows = await db
    .select({
      id: patients.id,
      label: patients.label,
      status: patients.status,
    })
    .from(patients)
    .orderBy(asc(patients.label));
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    status: (r.status as PatientSummary["status"]) ?? "prospect",
  }));
}

export async function startLiveSession(
  kind: SessionKind,
  opts: { patientId?: string; newPatientName?: string } = {}
): Promise<void> {
  let patientId = opts.patientId;

  if (!patientId && opts.newPatientName) {
    const trimmed = opts.newPatientName.trim();
    if (trimmed.length === 0) {
      throw new Error("Nom du patient vide");
    }
    const existing = await db
      .select({ id: patients.id })
      .from(patients)
      .where(ilike(patients.label, trimmed))
      .limit(1);
    if (existing[0]) {
      patientId = existing[0].id;
    } else {
      const [created] = await db
        .insert(patients)
        .values({
          label: trimmed,
          status: "prospect",
          firstContactAt: new Date(),
        })
        .returning({ id: patients.id });
      patientId = created.id;
    }
  }

  const id = await insertSession({
    kind,
    source: "live",
    patientId: patientId ?? null,
  });
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
  const consultationScenario = getScenarioBySlug(slug);
  const phoneScenario = getPhoneScenarioBySlug(slug);

  let patientLabel: string;
  let kind: SessionKind;
  let seedHint: string;
  if (consultationScenario) {
    patientLabel = consultationScenario.patientLabel;
    kind = "consultation";
    seedHint = "pnpm seed:replay";
  } else if (phoneScenario) {
    patientLabel = phoneScenario.callerLabel;
    kind = "phone_call";
    seedHint = "pnpm seed:replay-phone";
  } else {
    throw new Error(`Scénario inconnu: ${slug}`);
  }

  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.label, patientLabel))
    .limit(1);
  if (!patient) {
    throw new Error(`Patient "${patientLabel}" non seedé. Lancez ${seedHint}.`);
  }

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.source, "replay"),
        eq(sessions.patientId, patient.id),
        eq(sessions.kind, kind)
      )
    )
    .limit(1);
  if (!session) {
    throw new Error(`Session replay "${slug}" non seedée. Lancez ${seedHint}.`);
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
        metadata: null,
      })
      .where(eq(sessions.id, session.id));
  });

  const route = kind === "consultation" ? `/consultations/${session.id}` : `/appels/${session.id}`;
  redirect(route);
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
