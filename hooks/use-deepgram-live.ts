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
  const startedAtRef = useRef<number>(0);
  const lastEndMsRef = useRef<number>(-1);
  const currentSpeakerRef = useRef<LiveSpeaker>("practitioner");

  // Deepgram live diarization produced unreliable results on the target traffic
  // (both humans labeled as speaker 0 across nova-3 and nova-2). Pivot : infer
  // speaker turns from silence gaps between utterances. A gap > 1s in stream
  // time is treated as a turn change — imperfect but > 80% right in live
  // roleplay and far better than "everything = practitioner".
  const SPEAKER_GAP_MS = 1000;
  const nextSpeakerFromGap = useCallback((startMs: number, endMs: number): LiveSpeaker => {
    const isFirst = lastEndMsRef.current < 0;
    const gap = isFirst ? 0 : startMs - lastEndMsRef.current;
    if (!isFirst && gap > SPEAKER_GAP_MS) {
      currentSpeakerRef.current = currentSpeakerRef.current === "practitioner" ? "patient" : "practitioner";
    }
    lastEndMsRef.current = endMs;
    return currentSpeakerRef.current;
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

      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (!apiKey) throw new Error("NEXT_PUBLIC_DEEPGRAM_API_KEY not set");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const params = new URLSearchParams({
        model: "nova-3-general",
        language: "fr",
        punctuate: "true",
        smart_format: "true",
        interim_results: "true",
        endpointing: "300",
      });
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ["token", apiKey]
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

        const startMs = Math.round(data.start * 1000);
        const endMs = Math.round((data.start + data.duration) * 1000);
        const speaker = nextSpeakerFromGap(startMs, endMs);
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
  }, [flushLines, nextSpeakerFromGap]);

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
