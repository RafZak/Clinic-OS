import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, transcriptLines } from "@/db/schema";
import { createSignedAudioUrl } from "@/lib/supabase/storage";
import { readSessionLocale } from "@/lib/sessions";
import type { Locale } from "@/lib/locale";

type DGUtterance = {
  start: number;
  end: number;
  confidence?: number;
  transcript: string;
  speaker?: number;
};

type DGResponse = {
  results?: {
    utterances?: DGUtterance[];
  };
};

export type RetranscribeOutcome =
  | { ok: true; lines: number }
  | { skipped: "not-pending" | "no-audio" };

/**
 * Ré-transcrit l'audio d'une session via Deepgram prerecorded (diarize=true).
 * Remplace les transcript_lines live par la version batch avec attribution
 * des voix. Idempotent via lock atomique sur sessions.analysis_status.
 *
 * Sur échec : flip status=failed + analysis_error, re-throw pour que
 * l'endpoint log. Re-cliquer "Relancer" refera le même lock (pending|failed).
 */
export async function retranscribeSession(sessionId: string): Promise<RetranscribeOutcome> {
  const t0 = Date.now();

  const locked = await db
    .update(sessions)
    .set({ analysisStatus: "transcribing", analysisError: null })
    .where(
      and(
        eq(sessions.id, sessionId),
        or(eq(sessions.analysisStatus, "pending"), eq(sessions.analysisStatus, "failed"))
      )
    )
    .returning({
      id: sessions.id,
      audioUrl: sessions.audioUrl,
      metadata: sessions.metadata,
    });

  if (locked.length === 0) {
    return { skipped: "not-pending" };
  }

  const { audioUrl } = locked[0];
  const locale = readSessionLocale(locked[0].metadata);

  try {
    if (!audioUrl) {
      await db
        .update(sessions)
        .set({ analysisStatus: "transcribed" })
        .where(eq(sessions.id, sessionId));
      log(sessionId, "retranscribe", "no-audio", Date.now() - t0);
      return { skipped: "no-audio" };
    }

    const signedUrl = await createSignedAudioUrl(audioUrl);
    const dg = await callDeepgramPrerecorded(signedUrl, locale);
    const utterances = dg.results?.utterances ?? [];

    const speakerMap = buildSpeakerMap(utterances);
    const lines = utterances
      .filter((u) => u.transcript && u.transcript.trim().length > 0)
      .map((u) => ({
        speaker:
          typeof u.speaker === "number"
            ? speakerMap.get(u.speaker) ?? "practitioner"
            : "practitioner",
        startMs: Math.round(u.start * 1000),
        endMs: Math.round(u.end * 1000),
        text: u.transcript.trim(),
        confidence:
          typeof u.confidence === "number"
            ? u.confidence.toFixed(3)
            : null,
      }));

    // Filet de sécurité : si le batch ne renvoie aucune utterance (audio
    // illisible, langue mal détectée, etc.) on PRÉSERVE les lignes captées
    // par le live et on marque la session 'transcribed' pour laisser analyze
    // tenter sa chance dessus. Si live=0 aussi, analyze détectera le vide
    // proprement avec un message clair en aval.
    if (lines.length === 0) {
      const existing = await db
        .select({ id: transcriptLines.id })
        .from(transcriptLines)
        .where(eq(transcriptLines.sessionId, sessionId))
        .limit(1);
      await db
        .update(sessions)
        .set({ analysisStatus: "transcribed" })
        .where(eq(sessions.id, sessionId));
      log(sessionId, "retranscribe", "ok-empty-batch", Date.now() - t0, {
        liveLinesPreserved: existing.length,
        locale,
      });
      return { ok: true, lines: existing.length };
    }

    await db.transaction(async (tx) => {
      await tx.delete(transcriptLines).where(eq(transcriptLines.sessionId, sessionId));
      const chunkSize = 200;
      for (let i = 0; i < lines.length; i += chunkSize) {
        const slice = lines.slice(i, i + chunkSize).map((l) => ({
          sessionId,
          speaker: l.speaker,
          startMs: l.startMs,
          endMs: l.endMs,
          text: l.text,
          confidence: l.confidence,
        }));
        await tx.insert(transcriptLines).values(slice);
      }
      await tx
        .update(sessions)
        .set({ analysisStatus: "transcribed" })
        .where(eq(sessions.id, sessionId));
    });

    log(sessionId, "retranscribe", "ok", Date.now() - t0, {
      lines: lines.length,
      locale,
    });
    return { ok: true, lines: lines.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(sessions)
      .set({ analysisStatus: "failed", analysisError: `retranscribe: ${msg}`.slice(0, 2000) })
      .where(eq(sessions.id, sessionId));
    log(sessionId, "retranscribe", "failed", Date.now() - t0, { error: msg });
    throw err;
  }
}

async function callDeepgramPrerecorded(
  url: string,
  locale: Locale
): Promise<DGResponse> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY manquant");

  const params = new URLSearchParams({
    model: "nova-3-general",
    language: locale,
    punctuate: "true",
    smart_format: "true",
    diarize: "true",
    utterances: "true",
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Deepgram ${res.status}: ${body.slice(0, 300)}`);
  }

  return (await res.json()) as DGResponse;
}

function buildSpeakerMap(
  utterances: DGUtterance[]
): Map<number, "practitioner" | "patient"> {
  const map = new Map<number, "practitioner" | "patient">();
  for (const u of utterances) {
    if (typeof u.speaker !== "number") continue;
    if (!map.has(u.speaker)) {
      map.set(u.speaker, map.size === 0 ? "practitioner" : "patient");
    }
  }
  return map;
}

function log(
  sessionId: string,
  step: string,
  status: string,
  durationMs: number,
  extra: Record<string, unknown> = {}
) {
  console.log(
    JSON.stringify({ tag: "analysis", sessionId, step, status, durationMs, ...extra })
  );
}
