"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db/client";
import {
  coachingInsights,
  patientEvents,
  patients,
  sessionArtifacts,
  sessionScores,
  sessions,
  transcriptLines,
  vaultPages,
} from "@/db/schema";

const AUDIO_BUCKET = "sessions";

export type DeletePatientsPreview = {
  patientCount: number;
  consultationsCount: number;
  phoneCallsCount: number;
  eventsCount: number;
  vaultPagesCount: number;
  audioFilesCount: number;
  patientLabels: string[];
};

export type DeletePatientsResult = {
  ok: true;
  deleted: {
    patients: number;
    sessions: number;
    events: number;
    vaultPages: number;
    audioFiles: number;
    audioErrors: number;
  };
};

function normalizeIds(ids: string[]): string[] {
  const trimmed = ids
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0);
  return Array.from(new Set(trimmed));
}

export async function previewDeletePatients(
  patientIds: string[]
): Promise<DeletePatientsPreview> {
  const ids = normalizeIds(patientIds);
  if (ids.length === 0) {
    return {
      patientCount: 0,
      consultationsCount: 0,
      phoneCallsCount: 0,
      eventsCount: 0,
      vaultPagesCount: 0,
      audioFilesCount: 0,
      patientLabels: [],
    };
  }

  const patientRows = await db
    .select({ id: patients.id, label: patients.label })
    .from(patients)
    .where(inArray(patients.id, ids));

  const sessionRows = await db
    .select({
      id: sessions.id,
      kind: sessions.kind,
      audioUrl: sessions.audioUrl,
    })
    .from(sessions)
    .where(inArray(sessions.patientId, ids));

  const sessionIds = sessionRows.map((s) => s.id);

  const eventsCountRow = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(patientEvents)
    .where(inArray(patientEvents.patientId, ids));

  let vaultPagesCount = 0;
  if (sessionIds.length > 0 || ids.length > 0) {
    const vaultRow = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(vaultPages)
      .where(
        or(
          and(
            eq(vaultPages.kind, "patient"),
            inArray(vaultPages.entityId, ids)
          ),
          sessionIds.length > 0
            ? and(
                eq(vaultPages.kind, "session"),
                inArray(vaultPages.entityId, sessionIds)
              )
            : sql`false`
        )
      );
    vaultPagesCount = Number(vaultRow[0]?.n ?? 0);
  }

  return {
    patientCount: patientRows.length,
    consultationsCount: sessionRows.filter((s) => s.kind === "consultation")
      .length,
    phoneCallsCount: sessionRows.filter((s) => s.kind === "phone_call").length,
    eventsCount: Number(eventsCountRow[0]?.n ?? 0),
    vaultPagesCount,
    audioFilesCount: sessionRows.filter((s) => s.audioUrl).length,
    patientLabels: patientRows.map((p) => p.label),
  };
}

function audioPathFromUrl(audioUrl: string | null): string | null {
  if (!audioUrl) return null;
  const prefix = `${AUDIO_BUCKET}/`;
  return audioUrl.startsWith(prefix) ? audioUrl.slice(prefix.length) : audioUrl;
}

export async function deletePatients(
  patientIds: string[]
): Promise<DeletePatientsResult> {
  const ids = normalizeIds(patientIds);
  if (ids.length === 0) {
    return {
      ok: true,
      deleted: {
        patients: 0,
        sessions: 0,
        events: 0,
        vaultPages: 0,
        audioFiles: 0,
        audioErrors: 0,
      },
    };
  }

  const sessionRows = await db
    .select({
      id: sessions.id,
      audioUrl: sessions.audioUrl,
    })
    .from(sessions)
    .where(inArray(sessions.patientId, ids));

  const sessionIds = sessionRows.map((s) => s.id);
  const audioPaths = sessionRows
    .map((s) => audioPathFromUrl(s.audioUrl))
    .filter((p): p is string => Boolean(p));

  const counters = await db.transaction(async (tx) => {
    let vaultDeleted = 0;

    if (ids.length > 0) {
      const r = await tx
        .delete(vaultPages)
        .where(
          and(
            eq(vaultPages.kind, "patient"),
            inArray(vaultPages.entityId, ids)
          )
        )
        .returning({ id: vaultPages.id });
      vaultDeleted += r.length;
    }

    if (sessionIds.length > 0) {
      const r = await tx
        .delete(vaultPages)
        .where(
          and(
            eq(vaultPages.kind, "session"),
            inArray(vaultPages.entityId, sessionIds)
          )
        )
        .returning({ id: vaultPages.id });
      vaultDeleted += r.length;
    }

    const deletedEvents = await tx
      .delete(patientEvents)
      .where(inArray(patientEvents.patientId, ids))
      .returning({ id: patientEvents.id });

    if (sessionIds.length > 0) {
      // Defensive cleanup: cascades cover these but we are explicit so the
      // intent is obvious if the schema ever changes.
      await tx
        .delete(transcriptLines)
        .where(inArray(transcriptLines.sessionId, sessionIds));
      await tx
        .delete(sessionScores)
        .where(inArray(sessionScores.sessionId, sessionIds));
      await tx
        .delete(coachingInsights)
        .where(inArray(coachingInsights.sessionId, sessionIds));
      await tx
        .delete(sessionArtifacts)
        .where(inArray(sessionArtifacts.sessionId, sessionIds));
    }

    const deletedSessions = await tx
      .delete(sessions)
      .where(inArray(sessions.patientId, ids))
      .returning({ id: sessions.id });

    const deletedPatients = await tx
      .delete(patients)
      .where(inArray(patients.id, ids))
      .returning({ id: patients.id });

    return {
      patients: deletedPatients.length,
      sessions: deletedSessions.length,
      events: deletedEvents.length,
      vaultPages: vaultDeleted,
    };
  });

  let audioFiles = 0;
  let audioErrors = 0;
  if (audioPaths.length > 0) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const supabase = createClient(url, key, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .remove(audioPaths);
      if (error) {
        audioErrors = audioPaths.length;
        console.error("[deletePatients] storage remove error", error);
      } else {
        audioFiles = data?.length ?? 0;
      }
    } else {
      audioErrors = audioPaths.length;
      console.warn(
        "[deletePatients] Supabase env missing — skipped audio cleanup"
      );
    }
  }

  revalidatePath("/patients");
  revalidatePath("/");
  revalidatePath("/admin/vault");

  return {
    ok: true,
    deleted: {
      ...counters,
      audioFiles,
      audioErrors,
    },
  };
}
