# J5 — Live Coaching Console (consultation + appel entrant) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le coaching consultation et appel entrant **live** — bouton "Nouvelle session" → micro + Deepgram Nova-3 streaming FR → console 3 colonnes (transcription / framework / insights placeholder) → bouton "Terminer" qui persiste + redirige vers une page résultats shell (remplie en J6).

**Architecture :**
- Bouton header → Server Action `createSession({ kind })` → redirect `/consultations/[id]` ou `/appels/[id]`.
- La route `[id]` branche selon `sessions.status` : `in_progress` → `<LiveConsole/>` (client), `completed` → page résultats (shell J5, rempli J6).
- Browser : `getUserMedia` + `MediaRecorder` (webm/opus avec fallback mp4/aac Safari) → chunks binaires → WebSocket direct vers `wss://api.deepgram.com/v1/listen` authentifié par token éphémère obtenu depuis `/api/deepgram/token`.
- Batcher les transcripts finaux → `POST /api/sessions/[id]/transcript` (insert `transcript_lines`). Audio concaténé en fin de session → `POST /api/sessions/[id]/audio` (upload bucket Supabase Storage `sessions`).
- Mapping diarization Deepgram (entiers 0/1/…) → `practitioner|patient` via heuristique **premier parleur = practitioner**.

**Tech Stack :**
- Next.js 16 App Router (Server Actions + Route Handlers)
- Drizzle ORM + Supabase Postgres + Supabase Storage (bucket `sessions`)
- Deepgram SDK v4.11 (REST `/v1/auth/grant`) + Deepgram Listen WebSocket `nova-3-general` FR
- Browser : `MediaRecorder`, `WebSocket` (subprotocol token), `getUserMedia`
- React 19 Client Components, shadcn/ui, Tailwind 4

**Validations utilisateur intégrées** (les 4 décisions posées) :
1. Token éphémère Deepgram + WS direct browser ✅
2. Heuristique "premier parleur = practitioner" ✅
3. Upload audio final vers Supabase Storage ✅
4. Les deux flows (consultation + appel) en J5 ✅

**Note TDD :** Le repo n'a pas de test harness Vitest/Playwright, et le setup n'est pas un bon investissement au milieu du sprint démo (J10 = dead-line). Chaque tâche **doit** donc finir par une étape **Verify** explicite (curl, tsx script, ou scénario browser chronométré). Preuve avant assertion. Ne jamais claim "ça marche" sans output observable copié dans le journal.

---

## Arborescence fichiers

**Créés :**
- `app/actions/sessions.ts` — Server Actions `createSession`, `completeSession`
- `app/api/deepgram/token/route.ts` — POST, short-lived token Deepgram
- `app/api/sessions/[id]/transcript/route.ts` — POST, insert batch `transcript_lines`
- `app/api/sessions/[id]/audio/route.ts` — POST, upload audio vers Storage `sessions`
- `lib/sessions.ts` — `getSessionById`, `completeSessionDB` helpers Drizzle
- `lib/supabase/storage.ts` — Client admin (service role) + helper `uploadSessionAudio`
- `scripts/bootstrap-storage.ts` — créer le bucket `sessions` (idempotent)
- `hooks/use-deepgram-live.ts` — hook client tout-en-un (mic, MediaRecorder, WS, batching)
- `components/live/live-console.tsx` — container 3 colonnes
- `components/live/live-header.tsx` — timer + actions (Arrêter / Abandonner)
- `components/live/live-transcript.tsx` — colonne gauche, transcription scrollante
- `components/live/live-framework.tsx` — colonne centre, étapes framework (stub J5)
- `components/live/live-insights.tsx` — colonne droite, placeholder
- `components/live/results-shell.tsx` — shell page résultats (vide J5, rempli J6)

**Modifiés :**
- `components/layout/new-session-button.tsx` — dialog Live / Replay, branche sur Server Action
- `app/consultations/[id]/page.tsx` — fetch session + branche status
- `app/appels/[id]/page.tsx` — idem
- `JOURNAL.md` — append section J5

**Inchangés (vérifiés) :** `db/schema.ts` (toutes les colonnes nécessaires existent déjà : `sessions.status`, `.audio_url`, `.duration_seconds`, `transcript_lines.speaker/start_ms/end_ms/text/confidence`).

---

## Conventions transversales

- **TypeScript strict**, pas de `any` implicite. Les messages Deepgram sont typés via un type `DeepgramMessage` local dans le hook.
- **Client components** : uniquement pour ce qui touche à `window`/`navigator`/`WebSocket`/`MediaRecorder`. Tout le reste reste Server Component.
- **Pas de commentaires** sauf si le WHY est non-évident (exemple justifié : l'heuristique speaker-0 = practitioner doit être commentée).
- **Server Actions** pour mutations, **Route Handlers** pour streaming ou upload multipart uniquement.
- **Commits Conventional** à la fin de chaque tâche logique (pas à chaque fichier).

---

## Task 1 : Server Actions sessions

**Files:**
- Create: `app/actions/sessions.ts`
- Create: `lib/sessions.ts`

- [ ] **Step 1.1 : Créer le helper Drizzle `lib/sessions.ts`**

```ts
// lib/sessions.ts
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
```

- [ ] **Step 1.2 : Créer `app/actions/sessions.ts`**

```ts
// app/actions/sessions.ts
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
```

- [ ] **Step 1.3 : Verify via script tsx**

Créer un script ad-hoc one-shot :
```bash
cat > /tmp/verify-sessions.ts <<'EOF'
import { config } from "dotenv";
config({ path: ".env.local" });
import { insertSession, getSessionById, markSessionCompleted, markSessionAborted } from "./lib/sessions";

async function main() {
  const id = await insertSession({ kind: "consultation", source: "live" });
  console.log("inserted", id);
  let row = await getSessionById(id);
  console.log("status after insert:", row?.status);
  await markSessionCompleted(id, { audioUrl: null, durationSeconds: 123 });
  row = await getSessionById(id);
  console.log("status after complete:", row?.status, "duration:", row?.durationSeconds);
  await markSessionAborted(id);
  row = await getSessionById(id);
  console.log("status after abort (should stay completed or change? check):", row?.status);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
EOF
pnpm exec tsx /tmp/verify-sessions.ts
```

Expected output : `inserted <uuid>` puis `status after insert: in_progress` puis `status after complete: completed duration: 123` puis `status after abort (...): aborted`.
Puis : `rm /tmp/verify-sessions.ts`.

- [ ] **Step 1.4 : Commit**

```bash
git add app/actions/sessions.ts lib/sessions.ts
git commit -m "feat(sessions): server actions + drizzle helpers for live sessions"
```

---

## Task 2 : Deepgram token endpoint

**Files:**
- Create: `app/api/deepgram/token/route.ts`

- [ ] **Step 2.1 : Écrire le Route Handler**

```ts
// app/api/deepgram/token/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TTL_SECONDS = 1800;

export async function POST(): Promise<Response> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY missing" }, { status: 500 });
  }

  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: TTL_SECONDS }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "deepgram_grant_failed", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return NextResponse.json({ accessToken: data.access_token, expiresIn: data.expires_in });
}
```

- [ ] **Step 2.2 : Verify via curl**

Dev server en route (`pnpm dev`), puis :
```bash
curl -s -X POST http://localhost:3000/api/deepgram/token | jq .
```

Expected :
```json
{ "accessToken": "<jwt>", "expiresIn": 1800 }
```

Si erreur 502 avec `deepgram_grant_failed`, l'endpoint officiel a peut-être changé : tenter `/v1/auth/tokens` ou vérifier la réponse Deepgram. Adapter en conséquence et redocumenter ici.

- [ ] **Step 2.3 : Commit**

```bash
git add app/api/deepgram/token/route.ts
git commit -m "feat(deepgram): short-lived token endpoint for browser live streaming"
```

---

## Task 3 : Transcript persistence endpoint

**Files:**
- Create: `app/api/sessions/[id]/transcript/route.ts`

- [ ] **Step 3.1 : Écrire le Route Handler**

```ts
// app/api/sessions/[id]/transcript/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { transcriptLines } from "@/db/schema";

export const runtime = "nodejs";

const BodySchema = z.object({
  lines: z
    .array(
      z.object({
        speaker: z.enum(["practitioner", "patient"]),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
        text: z.string().min(1),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data.lines.map((l) => ({
    sessionId: id,
    speaker: l.speaker,
    startMs: l.startMs,
    endMs: l.endMs,
    text: l.text,
    confidence: l.confidence != null ? l.confidence.toFixed(3) : null,
  }));

  await db.insert(transcriptLines).values(rows);
  return NextResponse.json({ inserted: rows.length });
}
```

- [ ] **Step 3.2 : Verify via curl**

On suppose qu'une session existe (prendre l'id créé en Task 1 Step 1.3 ou créer via l'action, ou via SQL). Alternative : créer manuellement :
```bash
SESSION_ID=$(pnpm exec tsx -e '
import { config } from "dotenv"; config({ path: ".env.local" });
import { insertSession } from "./lib/sessions";
insertSession({ kind: "consultation", source: "live" }).then(id => console.log(id)).catch(e => { console.error(e); process.exit(1); });
' | tail -1)
echo "Session: $SESSION_ID"

curl -s -X POST "http://localhost:3000/api/sessions/$SESSION_ID/transcript" \
  -H "Content-Type: application/json" \
  -d '{"lines":[{"speaker":"practitioner","startMs":0,"endMs":1500,"text":"Bonjour madame","confidence":0.97}]}' | jq .
```

Expected : `{ "inserted": 1 }`.

Vérifier côté DB :
```bash
pnpm exec tsx -e "
import { config } from 'dotenv'; config({ path: '.env.local' });
import { db } from './db/client';
import { transcriptLines } from './db/schema';
import { eq } from 'drizzle-orm';
db.select().from(transcriptLines).where(eq(transcriptLines.sessionId, '$SESSION_ID')).then(r => console.log(r)).catch(e => { console.error(e); process.exit(1); });
"
```

Expected : 1 ligne affichée avec le texte `"Bonjour madame"`.

- [ ] **Step 3.3 : Commit**

```bash
git add app/api/sessions/[id]/transcript/route.ts
git commit -m "feat(sessions): transcript persistence endpoint with zod validation"
```

---

## Task 4 : Bucket Supabase Storage + upload endpoint

**Files:**
- Create: `lib/supabase/storage.ts`
- Create: `scripts/bootstrap-storage.ts`
- Create: `app/api/sessions/[id]/audio/route.ts`

- [ ] **Step 4.1 : Helper admin Supabase**

```ts
// lib/supabase/storage.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "sessions";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing (URL or SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function ensureSessionsBucket(): Promise<void> {
  const s = admin();
  const { data: list } = await s.storage.listBuckets();
  if (list?.some((b) => b.name === BUCKET)) return;
  const { error } = await s.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function uploadSessionAudio(
  sessionId: string,
  bytes: ArrayBuffer | Buffer,
  contentType: string
): Promise<string> {
  const s = admin();
  const ext = contentType.includes("mp4") ? "mp4" : "webm";
  const path = `${sessionId}.${ext}`;
  const { error } = await s.storage.from(BUCKET).upload(path, bytes as ArrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return `${BUCKET}/${path}`;
}
```

- [ ] **Step 4.2 : Script bootstrap du bucket**

```ts
// scripts/bootstrap-storage.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { ensureSessionsBucket } from "../lib/supabase/storage";

async function main() {
  await ensureSessionsBucket();
  console.log("ok — bucket `sessions` prêt");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

Ajouter au `package.json` > scripts :
```json
"storage:bootstrap": "tsx scripts/bootstrap-storage.ts"
```

- [ ] **Step 4.3 : Exécuter le bootstrap**

```bash
pnpm storage:bootstrap
```

Expected : `ok — bucket `sessions` prêt`. Vérifier dans le dashboard Supabase (Storage → Buckets) que `sessions` apparaît en privé.

- [ ] **Step 4.4 : Route Handler upload audio**

```ts
// app/api/sessions/[id]/audio/route.ts
import { NextResponse } from "next/server";
import { uploadSessionAudio } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 200 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const contentType = req.headers.get("content-type") ?? "audio/webm";
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const path = await uploadSessionAudio(id, bytes, contentType);
  return NextResponse.json({ path });
}
```

- [ ] **Step 4.5 : Verify via curl avec un petit binaire**

```bash
dd if=/dev/urandom of=/tmp/fake.webm bs=1024 count=50
SESSION_ID=$(pnpm exec tsx -e '
import { config } from "dotenv"; config({ path: ".env.local" });
import { insertSession } from "./lib/sessions";
insertSession({ kind: "consultation", source: "live" }).then(id => console.log(id)).catch(e => { console.error(e); process.exit(1); });
' | tail -1)

curl -s -X POST "http://localhost:3000/api/sessions/$SESSION_ID/audio" \
  -H "Content-Type: audio/webm" \
  --data-binary @/tmp/fake.webm | jq .
rm /tmp/fake.webm
```

Expected : `{ "path": "sessions/<uuid>.webm" }`. Vérifier dans le dashboard Supabase Storage qu'un fichier de ~50 KB est présent dans `sessions/`.

- [ ] **Step 4.6 : Commit**

```bash
git add lib/supabase/storage.ts scripts/bootstrap-storage.ts app/api/sessions/[id]/audio/route.ts package.json
git commit -m "feat(storage): sessions bucket + audio upload endpoint + bootstrap script"
```

---

## Task 5 : Hook `useDeepgramLive`

**Files:**
- Create: `hooks/use-deepgram-live.ts`

Ce hook est la pièce maîtresse : il encapsule la permission micro, le MediaRecorder, la connexion WS Deepgram, le parsing des messages, le batching vers `/transcript`, le mapping speaker, et la production d'un blob audio final.

- [ ] **Step 5.1 : Écrire le hook complet**

```ts
// hooks/use-deepgram-live.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveSpeaker = "practitioner" | "patient";

export type LiveLine = {
  id: string;
  speaker: LiveSpeaker;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
};

export type LiveState =
  | { phase: "idle" }
  | { phase: "connecting" }
  | { phase: "recording"; startedAt: number }
  | { phase: "stopped"; startedAt: number; stoppedAt: number; audioBlob: Blob | null }
  | { phase: "error"; message: string };

export type UseDeepgramLiveArgs = {
  sessionId: string;
};

export type UseDeepgramLiveReturn = {
  state: LiveState;
  lines: LiveLine[];
  interim: string;
  latencyMs: number | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
};

type DGWord = { word: string; start: number; end: number; confidence: number; speaker?: number };

type DGResult = {
  type: "Results";
  is_final: boolean;
  speech_final?: boolean;
  start: number;
  duration: number;
  channel: { alternatives: { transcript: string; words: DGWord[] }[] };
};

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useDeepgramLive({ sessionId }: UseDeepgramLiveArgs): UseDeepgramLiveReturn {
  const [state, setState] = useState<LiveState>({ phase: "idle" });
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [interim, setInterim] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const flushBufferRef = useRef<LiveLine[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstSpeakerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastFinalAtRef = useRef<number>(0);

  const mapSpeaker = useCallback((dgSpeaker: number | undefined): LiveSpeaker => {
    if (dgSpeaker === undefined) return "practitioner";
    if (firstSpeakerRef.current === null) firstSpeakerRef.current = dgSpeaker;
    return dgSpeaker === firstSpeakerRef.current ? "practitioner" : "patient";
  }, []);

  const flushLines = useCallback(async () => {
    if (flushBufferRef.current.length === 0) return;
    const batch = flushBufferRef.current;
    flushBufferRef.current = [];
    try {
      await fetch(`/api/sessions/${sessionId}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: batch.map((l) => ({
            speaker: l.speaker,
            startMs: l.startMs,
            endMs: l.endMs,
            text: l.text,
            confidence: l.confidence,
          })),
        }),
      });
    } catch (err) {
      console.warn("transcript flush failed", err);
      flushBufferRef.current.unshift(...batch);
    }
  }, [sessionId]);

  const start = useCallback(async () => {
    setState({ phase: "connecting" });
    try {
      const mime = pickMimeType();
      if (!mime) throw new Error("MediaRecorder not supported in this browser");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const tokenRes = await fetch("/api/deepgram/token", { method: "POST" });
      if (!tokenRes.ok) throw new Error(`token grant failed: ${tokenRes.status}`);
      const { accessToken } = (await tokenRes.json()) as { accessToken: string };

      const params = new URLSearchParams({
        model: "nova-3-general",
        language: "fr",
        punctuate: "true",
        smart_format: "true",
        interim_results: "true",
        diarize: "true",
        endpointing: "300",
      });
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ["token", accessToken]
      );
      wsRef.current = ws;

      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        startedAtRef.current = performance.now();
        setState({ phase: "recording", startedAt: Date.now() });
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        recorderRef.current = recorder;
        audioChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
            if (ws.readyState === WebSocket.OPEN) {
              ev.data.arrayBuffer().then((buf) => {
                if (ws.readyState === WebSocket.OPEN) ws.send(buf);
              });
            }
          }
        };
        recorder.start(250);

        flushTimerRef.current = setInterval(() => {
          void flushLines();
        }, 2000);
      };

      ws.onmessage = (ev) => {
        let data: DGResult;
        try {
          data = JSON.parse(typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data));
        } catch {
          return;
        }
        if (data.type !== "Results") return;
        const alt = data.channel.alternatives[0];
        if (!alt || !alt.transcript) {
          if (!data.is_final) setInterim("");
          return;
        }

        if (!data.is_final) {
          setInterim(alt.transcript);
          return;
        }

        const now = performance.now();
        const speechEndInStream = (data.start + data.duration) * 1000;
        const measured = now - startedAtRef.current - speechEndInStream;
        if (measured >= 0 && measured < 10000) setLatencyMs(Math.round(measured));

        const speaker = mapSpeaker(alt.words[0]?.speaker);
        const startMs = Math.round(data.start * 1000);
        const endMs = Math.round((data.start + data.duration) * 1000);
        const avgConf =
          alt.words.length > 0
            ? alt.words.reduce((s, w) => s + w.confidence, 0) / alt.words.length
            : undefined;

        const line: LiveLine = {
          id: randomId(),
          speaker,
          startMs,
          endMs,
          text: alt.transcript,
          confidence: avgConf,
        };
        setLines((prev) => [...prev, line]);
        setInterim("");
        flushBufferRef.current.push(line);
        lastFinalAtRef.current = Date.now();
        if (flushBufferRef.current.length >= 5) void flushLines();
      };

      ws.onerror = () => {
        setState({ phase: "error", message: "Connexion Deepgram interrompue" });
      };

      ws.onclose = () => {
        if (flushTimerRef.current) {
          clearInterval(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        void flushLines();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setState({ phase: "error", message });
    }
  }, [flushLines, mapSpeaker]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    const ws = wsRef.current;
    const stream = streamRef.current;
    const mime = recorder?.mimeType ?? "audio/webm";

    const stopPromise = new Promise<void>((resolve) => {
      if (!recorder || recorder.state === "inactive") return resolve();
      recorder.onstop = () => resolve();
      try { recorder.stop(); } catch { resolve(); }
    });
    await stopPromise;

    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "CloseStream" })); } catch {}
      try { ws.close(); } catch {}
    }

    if (stream) stream.getTracks().forEach((t) => t.stop());

    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    await flushLines();

    const blob = audioChunksRef.current.length > 0
      ? new Blob(audioChunksRef.current, { type: mime })
      : null;

    setState((prev) =>
      prev.phase === "recording"
        ? { phase: "stopped", startedAt: prev.startedAt, stoppedAt: Date.now(), audioBlob: blob }
        : prev
    );
    return blob;
  }, [flushLines]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wsRef.current?.close();
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, []);

  return { state, lines, interim, latencyMs, start, stop };
}
```

- [ ] **Step 5.2 : Typecheck**

```bash
pnpm typecheck
```

Expected : aucune erreur.

- [ ] **Step 5.3 : Commit**

```bash
git add hooks/use-deepgram-live.ts
git commit -m "feat(live): useDeepgramLive hook — mic + ws streaming + batched persistence"
```

---

## Task 6 : Colonne transcription live

**Files:**
- Create: `components/live/live-transcript.tsx`

- [ ] **Step 6.1 : Écrire le composant**

```tsx
// components/live/live-transcript.tsx
"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LiveLine } from "@/hooks/use-deepgram-live";

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function LiveTranscript({
  lines,
  interim,
}: {
  lines: LiveLine[];
  interim: string;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, interim]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Transcription en direct</span>
        <span>{lines.length} lignes</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 && !interim && (
          <p className="text-sm text-muted-foreground">
            En attente de la première prise de parole…
          </p>
        )}
        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.id} className="flex gap-3">
              <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {formatMs(l.startMs)}
              </span>
              <div className="flex flex-col gap-1">
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                    l.speaker === "practitioner"
                      ? "bg-brand/10 text-brand"
                      : "bg-surface-muted text-muted-foreground"
                  )}
                >
                  {l.speaker === "practitioner" ? "Professionnel" : "Patient"}
                </span>
                <p className="text-sm leading-relaxed text-ink">{l.text}</p>
              </div>
            </li>
          ))}
          {interim && (
            <li className="flex gap-3 opacity-60">
              <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                --:--
              </span>
              <p className="text-sm italic leading-relaxed text-muted-foreground">{interim}</p>
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6.2 : Commit (sera regroupé avec Tasks 7-9 pour ne pas morceler)**

Ne pas committer ici — commit groupé à la fin de la Task 9.

---

## Task 7 : Colonne framework

**Files:**
- Create: `components/live/live-framework.tsx`

- [ ] **Step 7.1 : Écrire le composant**

```tsx
// components/live/live-framework.tsx
"use client";

import { Circle } from "lucide-react";
import { getFramework, FRAMEWORK_LABEL, type FrameworkKind } from "@/lib/frameworks";

export function LiveFramework({ kind }: { kind: FrameworkKind }) {
  const steps = getFramework(kind);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Framework {FRAMEWORK_LABEL[kind]}</span>
        <span>{steps.length} étapes</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ol className="space-y-2">
          {steps.map((s) => (
            <li
              key={s.number}
              className="flex items-start gap-3 rounded-md border border-border-subtle bg-light/40 px-3 py-2"
            >
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold tabular-nums text-muted-foreground">
                {s.number}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{s.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <Circle className="size-2.5" aria-hidden />
                    À évaluer
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Les statuts seront renseignés en temps réel par l'analyseur IA — livré J6.
        </p>
      </div>
    </div>
  );
}
```

---

## Task 8 : Colonne insights (placeholder J5)

**Files:**
- Create: `components/live/live-insights.tsx`

- [ ] **Step 8.1 : Écrire le composant**

```tsx
// components/live/live-insights.tsx
"use client";

import { Sparkles } from "lucide-react";

export function LiveInsights({ latencyMs }: { latencyMs: number | null }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Insights</span>
        <span className="tabular-nums">
          {latencyMs != null ? `${latencyMs} ms` : "—"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-xs flex-col items-center gap-3 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">Analyseur IA en veille</p>
          <p className="text-xs text-muted-foreground">
            Les insights coaching s'activeront en temps réel à partir de J6
            (détection objection, upsell manqué, bonne pratique, rappel module).
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 9 : Header + container LiveConsole

**Files:**
- Create: `components/live/live-header.tsx`
- Create: `components/live/live-console.tsx`

- [ ] **Step 9.1 : Écrire `live-header.tsx`**

```tsx
// components/live/live-header.tsx
"use client";

import { Mic, MicOff, Square, XOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveState } from "@/hooks/use-deepgram-live";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function LiveHeader({
  state,
  elapsedMs,
  onStart,
  onStop,
  onAbort,
}: {
  state: LiveState;
  elapsedMs: number;
  onStart: () => void;
  onStop: () => void;
  onAbort: () => void;
}) {
  const recording = state.phase === "recording";
  const connecting = state.phase === "connecting";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex size-2.5 rounded-full ${
            recording ? "bg-brand animate-pulse" : "bg-border"
          }`}
          aria-hidden
        />
        <span className="font-mono text-lg tabular-nums text-ink">
          {formatElapsed(elapsedMs)}
        </span>
        {state.phase === "error" && (
          <span className="text-xs text-brand">{state.message}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!recording && state.phase !== "stopped" && (
          <Button
            size="sm"
            className="bg-brand text-primary-foreground hover:bg-brand-dark"
            onClick={onStart}
            disabled={connecting}
          >
            <Mic className="size-4" aria-hidden />
            {connecting ? "Connexion…" : "Démarrer l'enregistrement"}
          </Button>
        )}
        {recording && (
          <>
            <Button size="sm" variant="outline" onClick={onAbort}>
              <XOctagon className="size-4" aria-hidden />
              Abandonner
            </Button>
            <Button
              size="sm"
              className="bg-brand text-primary-foreground hover:bg-brand-dark"
              onClick={onStop}
            >
              <Square className="size-4" aria-hidden />
              Arrêter et analyser
            </Button>
          </>
        )}
        {state.phase === "stopped" && (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <MicOff className="size-4" aria-hidden />
            Enregistrement terminé
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.2 : Écrire `live-console.tsx`**

```tsx
// components/live/live-console.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FrameworkKind } from "@/lib/frameworks";
import { useDeepgramLive } from "@/hooks/use-deepgram-live";
import { finishLiveSession, abortLiveSession } from "@/app/actions/sessions";
import { LiveHeader } from "./live-header";
import { LiveTranscript } from "./live-transcript";
import { LiveFramework } from "./live-framework";
import { LiveInsights } from "./live-insights";

export function LiveConsole({
  sessionId,
  kind,
}: {
  sessionId: string;
  kind: FrameworkKind;
}) {
  const router = useRouter();
  const { state, lines, interim, latencyMs, start, stop } = useDeepgramLive({ sessionId });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.phase === "recording") {
      const from = state.startedAt;
      tickRef.current = setInterval(() => setElapsedMs(Date.now() - from), 500);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
  }, [state.phase, state]);

  const handleStop = async () => {
    setFinalizing(true);
    const blob = await stop();
    let audioUrl: string | null = null;
    if (blob && blob.size > 0) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/audio`, {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        if (res.ok) {
          const data = (await res.json()) as { path: string };
          audioUrl = data.path;
        }
      } catch (err) {
        console.warn("audio upload failed", err);
      }
    }
    await finishLiveSession(sessionId, {
      audioUrl,
      durationSeconds: Math.round(elapsedMs / 1000),
    });
    router.refresh();
  };

  const handleAbort = async () => {
    await stop();
    await abortLiveSession(sessionId);
    router.push(kind === "consultation" ? "/consultations" : "/appels");
  };

  return (
    <div className="flex flex-col gap-4">
      <LiveHeader
        state={state}
        elapsedMs={elapsedMs}
        onStart={() => void start()}
        onStop={() => void handleStop()}
        onAbort={() => void handleAbort()}
      />

      {finalizing && (
        <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
          Upload de l'audio et finalisation de la session…
        </div>
      )}

      <div className="grid h-[calc(100vh-220px)] min-h-[540px] grid-cols-12 gap-4">
        <div className="col-span-3 min-w-0">
          <LiveTranscript lines={lines} interim={interim} />
        </div>
        <div className="col-span-6 min-w-0">
          <LiveFramework kind={kind} />
        </div>
        <div className="col-span-3 min-w-0">
          <LiveInsights latencyMs={latencyMs} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9.3 : Typecheck**

```bash
pnpm typecheck
```

Expected : zéro erreur.

- [ ] **Step 9.4 : Commit les 4 composants live**

```bash
git add components/live/
git commit -m "feat(live): 3-column console — transcript + framework + insights placeholder"
```

---

## Task 10 : Page résultats shell (J5)

**Files:**
- Create: `components/live/results-shell.tsx`

- [ ] **Step 10.1 : Composant shell minimal**

```tsx
// components/live/results-shell.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FRAMEWORK_LABEL, type FrameworkKind } from "@/lib/frameworks";
import type { SessionRow } from "@/lib/sessions";

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function ResultsShell({ session }: { session: SessionRow }) {
  const kind = (session.kind as FrameworkKind) ?? "consultation";
  const backHref = kind === "consultation" ? "/consultations" : "/appels";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </Link>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          Session terminée
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface px-6 py-6">
        <h1 className="text-2xl font-semibold text-ink">
          Résultats — {FRAMEWORK_LABEL[kind]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Session <span className="font-mono">{session.id.slice(0, 8)}…</span> ·
          durée {formatDuration(session.durationSeconds)}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-light/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Score global</p>
            <p className="mt-1 text-2xl font-semibold text-ink">—</p>
          </div>
          <div className="rounded-md border border-border bg-light/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Insights détectés</p>
            <p className="mt-1 text-2xl font-semibold text-ink">—</p>
          </div>
          <div className="rounded-md border border-border bg-light/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Impact estimé</p>
            <p className="mt-1 text-2xl font-semibold text-ink">—</p>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted-foreground">
          L'analyseur IA (scoring par étape, insights chiffrés €, 4 artefacts) sera livré en J6-J8.
          L'audio et la transcription sont déjà en base pour cette session.
        </div>
      </div>
    </div>
  );
}
```

---

## Task 11 : Route pages consultations + appels branchent sur status

**Files:**
- Modify: `app/consultations/[id]/page.tsx`
- Modify: `app/appels/[id]/page.tsx`

- [ ] **Step 11.1 : Réécrire `app/consultations/[id]/page.tsx`**

```tsx
// app/consultations/[id]/page.tsx
import { notFound } from "next/navigation";
import { getSessionById } from "@/lib/sessions";
import { LiveConsole } from "@/components/live/live-console";
import { ResultsShell } from "@/components/live/results-shell";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) notFound();
  if (session.kind !== "consultation") notFound();

  if (session.status === "in_progress") {
    return <LiveConsole sessionId={id} kind="consultation" />;
  }
  return <ResultsShell session={session} />;
}
```

- [ ] **Step 11.2 : Réécrire `app/appels/[id]/page.tsx`**

```tsx
// app/appels/[id]/page.tsx
import { notFound } from "next/navigation";
import { getSessionById } from "@/lib/sessions";
import { LiveConsole } from "@/components/live/live-console";
import { ResultsShell } from "@/components/live/results-shell";

export default async function AppelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) notFound();
  if (session.kind !== "phone_call") notFound();

  if (session.status === "in_progress") {
    return <LiveConsole sessionId={id} kind="phone_call" />;
  }
  return <ResultsShell session={session} />;
}
```

- [ ] **Step 11.3 : Typecheck**

```bash
pnpm typecheck
```

Expected : zéro erreur.

- [ ] **Step 11.4 : Commit**

```bash
git add app/consultations/[id]/page.tsx app/appels/[id]/page.tsx components/live/results-shell.tsx
git commit -m "feat(live): route pages branch on session status + results shell"
```

---

## Task 12 : NewSessionButton — Dialog Live/Replay + Server Action

**Files:**
- Modify: `components/layout/new-session-button.tsx`

- [ ] **Step 12.1 : Remplacer le placeholder par un dialog fonctionnel**

```tsx
// components/layout/new-session-button.tsx
"use client";

import { Mic, Plus, Radio } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startLiveSession } from "@/app/actions/sessions";
import type { Role } from "@/lib/role";

export function NewSessionButton({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = role === "audioprothesiste" ? "Nouvelle consultation" : "Nouvel appel";
  const kind = role === "audioprothesiste" ? "consultation" : "phone_call";

  const onLive = () => {
    startTransition(async () => {
      await startLiveSession(kind);
    });
  };

  return (
    <>
      <Button
        size="sm"
        className="bg-brand text-primary-foreground hover:bg-brand-dark"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {role === "audioprothesiste"
                ? "Démarrer une consultation en direct ou rejouer un cas-école."
                : "Réceptionner un appel en direct ou rejouer un appel enregistré."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-2">
            <button
              type="button"
              onClick={onLive}
              disabled={pending}
              className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left transition hover:border-brand hover:bg-brand/5 disabled:opacity-50"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Mic className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">
                  {pending ? "Création de la session…" : "Démarrer en direct"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Micro + transcription Deepgram streaming — live coaching
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled
              className="flex items-start gap-3 rounded-md border border-dashed border-border bg-surface-muted px-4 py-3 text-left opacity-60"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted-foreground">
                <Radio className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">Rejouer une session</span>
                <span className="text-xs text-muted-foreground">
                  Les 3 cas-école seront disponibles à partir de J7.
                </span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 12.2 : Commit**

```bash
git add components/layout/new-session-button.tsx
git commit -m "feat(live): wire header button to createSession via dialog (live/replay)"
```

---

## Task 13 : Smoke test E2E en navigateur + plan B

Cette tâche ne produit pas de code, mais confirme que l'enchaînement marche sur Chrome **et** Safari. Pas de commit de code, mais une entrée JOURNAL.md qui documente les mesures.

- [ ] **Step 13.1 : Lancer le dev server**

```bash
pnpm dev
```

- [ ] **Step 13.2 : Test Chrome**

Ouvrir `http://localhost:3000` (Chrome récent), toggle rôle = audioprothésiste.
1. Clic "Nouvelle consultation" dans le header → dialog s'ouvre.
2. Clic "Démarrer en direct" → URL devient `/consultations/<uuid>`.
3. Page console 3 colonnes apparaît avec timer à 00:00, bouton "Démarrer l'enregistrement".
4. Clic "Démarrer l'enregistrement" → popup permission micro Chrome. Accepter.
5. Parler 3 phrases en français, marquer 1s de silence entre chacune.
   - **Vérifier** : lignes finales apparaissent dans la colonne gauche après chaque silence.
   - **Vérifier** : le speaker bubble est "Professionnel" sur au moins la 1re phrase.
   - **Vérifier** : la latence affichée dans la colonne droite est < 800 ms (PRD §18).
6. Clic "Arrêter et analyser" → message "Upload de l'audio…" → redirection vers la page résultats avec durée correcte.
7. **Vérifier** dans Supabase Studio : `sessions.status='completed'`, `audio_url='sessions/<uuid>.webm'`, lignes dans `transcript_lines`.

- [ ] **Step 13.3 : Test Safari (macOS)**

Répéter le scénario 13.2 sur Safari récent.
- **Si le micro est refusé** : vérifier Safari > Réglages > Confidentialité > Microphone.
- **Si MediaRecorder webm non supporté** : le hook doit basculer sur `audio/mp4`. L'upload doit produire un `.mp4` dans Storage (cf. helper `uploadSessionAudio`).
- Si échec : noter la version Safari et documenter dans JOURNAL.md, mais la démo tourne sur Chrome donc pas bloquant pour J10.

- [ ] **Step 13.4 : Tester le flow Appel entrant (assistant)**

Toggle rôle = assistant. Clic "Nouvel appel" → dialog → "Démarrer en direct" → `/appels/<uuid>` → console avec framework 6 étapes.

- [ ] **Step 13.5 : Test plan B — déconnexion WS**

Dans la console Chrome devtools, Network tab → se couper du WS manuellement (fermer l'onglet Network → offline). Vérifier que `state.phase === "error"` s'affiche dans le header et que le bouton "Abandonner" reste fonctionnel pour clean-up.

- [ ] **Step 13.6 : Noter les latences observées**

Dans le navigateur devtools console, lire les `latencyMs` affichés. Noter min / médiane / max sur 10 segments.

---

## Task 14 : JOURNAL.md J5 + commit final

**Files:**
- Modify: `JOURNAL.md`

- [ ] **Step 14.1 : Append la section J5**

Ajouter à la fin de `JOURNAL.md` :

```markdown

---

## J5 — 24 avril 2026

### Fait

- **Server Actions `sessions`** : `startLiveSession(kind)` insert + redirect, `finishLiveSession(id, patch)` update status+audio_url+duration, `abortLiveSession(id)`. Helpers Drizzle dans `lib/sessions.ts`.
- **Deepgram token endpoint** (`POST /api/deepgram/token`) : génère un short-lived JWT (ttl=1800s) via REST `/v1/auth/grant`. La clé root reste côté serveur.
- **WebSocket direct browser → Deepgram** : le hook `useDeepgramLive` connecte `wss://api.deepgram.com/v1/listen` avec subprotocol `["token", <jwt>]`, paramètres `nova-3-general` FR + `diarize` + `interim_results` + `endpointing=300`. Envoie les blobs MediaRecorder (webm/opus avec fallback mp4 Safari) en timeslice 250 ms.
- **UI live 3 colonnes** (`components/live/`) :
  - `LiveTranscript` (25 %) : lignes finales colorées par speaker, interim italique grisé, auto-scroll.
  - `LiveFramework` (50 %) : 10 / 6 étapes du framework avec statut "À évaluer" en stub — sera piloté par analyseur Claude en J6.
  - `LiveInsights` (25 %) : placeholder + affichage latence Deepgram live.
  - `LiveHeader` : timer HH:MM:SS, boutons "Démarrer", "Arrêter et analyser", "Abandonner".
- **Persistence** :
  - `transcript_lines` en live via `POST /api/sessions/[id]/transcript` (batch Zod validé, flush toutes les 2 s ou tous les 5 finals).
  - Mapping diarization entier → `practitioner|patient` par heuristique "premier parleur = practitioner".
  - Audio concaténé en fin de session, uploadé dans le bucket Supabase Storage `sessions/<uuid>.webm` (ou `.mp4` Safari) via `POST /api/sessions/[id]/audio`. Bucket bootstrap via `pnpm storage:bootstrap`.
- **Routing** : `/consultations/[id]` et `/appels/[id]` branchent sur `sessions.status` → `LiveConsole` si `in_progress`, `ResultsShell` si `completed`. Shell résultats vide (rempli J6-J8).
- **NewSessionButton** : dialog Live / Replay ; "Démarrer en direct" appelle la Server Action et redirige, "Rejouer" disabled jusqu'à J7.

### Mesures

- **Latence Deepgram** Chrome (mesurée dans le hook, voir devtools) : <remplir après test>.
- **Safari** : <remplir après test — support webm ? mp4 fallback utilisé ?>.
- **Taille audio** 45 min de consult estimée : ~50 Mo. Supabase Storage a 100 Go en plan pro — OK.

### Reste à faire

- **J6** : analyseur Claude streaming (scoring par étape ré-évalué toutes les 20 s + insights événementiels avec citations Layer A + estimated_impact_eur).
- **J6** : page résultats réelle — radar 10 / 6 étapes, liste insights triés par sévérité, onglet transcription annotée.
- **J7** : génération des 3 audios TTS ElevenLabs + mode replay (même page que live, audio joué depuis Storage, lignes déroulées selon timestamps).
- J8-J10 inchangé.

### Blockers / points d'attention

- L'heuristique "premier parleur = practitioner" peut se tromper en pratique (ex. patient tendu qui décroche lui-même un appel). À améliorer en J7 avec un toggle manuel "Inverser les rôles".
- Si latence Deepgram > 800 ms observée en production, plan B : passer en mode batch post-enregistrement (MediaRecorder → upload → Deepgram prerecorded → affichage). Non livré en J5 (scope créé si besoin).
- Le bouton "Abandonner" ne supprime pas l'audio ni les transcripts déjà inséré — seul `sessions.status` passe à `aborted`. Nettoyage propre à prévoir en roadmap admin.
```

(À compléter avec les valeurs concrètes mesurées au Step 13.6.)

- [ ] **Step 14.2 : Commit final**

```bash
git add JOURNAL.md
git commit -m "docs: j5 journal — live coaching console shipped (consultation + appel)"
```

- [ ] **Step 14.3 : Push**

Ne pas push automatiquement — demander confirmation à l'utilisateur avant `git push origin main` (règle du CLAUDE : actions qui affectent le shared state demandent confirmation).

---

## Récapitulatif — tâches et estimations

| # | Tâche | Livrable | Estimé |
|---|---|---|---|
| 1 | Server Actions sessions + helpers Drizzle | `app/actions/sessions.ts`, `lib/sessions.ts` | 30 min |
| 2 | Deepgram token endpoint | `app/api/deepgram/token/route.ts` | 20 min |
| 3 | Transcript persistence endpoint | `app/api/sessions/[id]/transcript/route.ts` | 20 min |
| 4 | Storage bucket + audio upload endpoint | `lib/supabase/storage.ts`, `scripts/bootstrap-storage.ts`, `app/api/sessions/[id]/audio/route.ts` | 30 min |
| 5 | `useDeepgramLive` hook | `hooks/use-deepgram-live.ts` | 90 min |
| 6 | Colonne transcription | `components/live/live-transcript.tsx` | 20 min |
| 7 | Colonne framework | `components/live/live-framework.tsx` | 20 min |
| 8 | Colonne insights (placeholder J5) | `components/live/live-insights.tsx` | 10 min |
| 9 | Header + container LiveConsole | `components/live/live-header.tsx`, `components/live/live-console.tsx` | 40 min |
| 10 | Results shell | `components/live/results-shell.tsx` | 15 min |
| 11 | Routes consult + appel branchent sur status | `app/consultations/[id]/page.tsx`, `app/appels/[id]/page.tsx` | 15 min |
| 12 | NewSessionButton dialog + action | `components/layout/new-session-button.tsx` | 15 min |
| 13 | QA Chrome + Safari + plan B | — | 45 min |
| 14 | JOURNAL.md + commit final | `JOURNAL.md` | 15 min |

**Total : ~6 h de travail focus.**

---

## Self-review

**Spec coverage (cf. prompt utilisateur) :**
- ✅ Bouton "Nouvelle consultation/appel" dans le header → getUserMedia → Deepgram WS streaming : Tasks 5, 12.
- ✅ UI 3 colonnes transcription / framework / insights : Tasks 6, 7, 8, 9.
- ✅ Framework 10 étapes consult + 6 étapes appel : Task 7 (via `lib/frameworks.ts` existant).
- ✅ Persistance `transcript_lines` avec speaker/diarization + timestamps + confidence : Tasks 3, 5.
- ✅ Bouton Terminer → `status='completed'` + redirect vers page résultats : Tasks 1, 9, 11.
- ✅ Test permission micro Chrome + Safari : Task 13.
- ✅ Plan B latence > 800 ms documenté : Task 13, Task 14 blockers.

**Placeholder scan :**
- Aucun "TODO" / "TBD" / "implement later" — chaque fichier est fourni en entier.
- Les steps "Verify" ont toutes un `Expected:` explicite avec output observable.

**Type consistency :**
- `LiveLine`, `LiveState`, `LiveSpeaker`, `FrameworkKind`, `SessionRow`, `SessionKind` sont déclarés une seule fois et référencés cohéremment.
- `SessionRow` est exporté depuis `lib/sessions.ts` et importé tel quel par `results-shell.tsx`.
- `startLiveSession(kind)` / `finishLiveSession(id, {audioUrl, durationSeconds})` / `abortLiveSession(id)` : signatures identiques dans l'action et dans les callers.

---

## Handoff

**Plan complet sauvegardé dans `docs/superpowers/plans/2026-04-24-j5-live-coaching.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — je dispatche un subagent neuf par tâche, je review entre chaque, itération rapide. Meilleur pour garder le main context propre et pour auditer étape par étape.

**2. Inline Execution** — j'exécute les tâches dans cette session avec des checkpoints à la fin de chaque groupe logique (par ex. après Task 4, puis Task 9, puis Task 13).

**Laquelle veux-tu ?**
