"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveLine } from "@/hooks/use-deepgram-live";
import type { FrameworkKind } from "@/lib/frameworks";
import { useLiveCoach } from "@/hooks/use-live-coach";
import { finishLiveSession, abortLiveSession } from "@/app/actions/sessions";
import { LiveTranscript } from "./live-transcript";
import { LiveFramework } from "./live-framework";
import { CoachPanel } from "./coach-panel";
import { ReplayHeader, type ReplayPhase } from "./replay-header";

const TAIL_BEFORE_END_MS = 800;

export function ReplayConsole({
  sessionId,
  kind,
  scriptLines,
  totalDurationMs,
  patientLabel,
}: {
  sessionId: string;
  kind: FrameworkKind;
  scriptLines: LiveLine[];
  totalDurationMs: number;
  patientLabel: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<ReplayPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startPerfRef = useRef<number>(0);
  const baseElapsedRef = useRef<number>(0);
  const endThreshold = totalDurationMs + TAIL_BEFORE_END_MS;

  useEffect(() => {
    if (phase !== "playing") return;
    startPerfRef.current = performance.now();
    baseElapsedRef.current = elapsedMs;
    const tick = (now: number) => {
      const next = baseElapsedRef.current + (now - startPerfRef.current);
      if (next >= endThreshold) {
        setElapsedMs(endThreshold);
        setPhase("ended");
        return;
      }
      setElapsedMs(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, endThreshold, elapsedMs]);

  useEffect(() => {
    if (phase !== "ended") return;
    const t = setTimeout(() => void handleFinish(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const visibleLines = useMemo(
    () => scriptLines.filter((l) => l.startMs <= elapsedMs),
    [elapsedMs, scriptLines]
  );

  const { bubbles, pending: coachPending } = useLiveCoach({
    sessionId,
    kind,
    lines: visibleLines,
    enabled: phase === "playing",
  });

  const handleStart = () => setPhase("playing");

  const handleStop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("ended");
  };

  const handleFinish = async () => {
    setPhase("finalizing");
    await finishLiveSession(sessionId, {
      audioUrl: null,
      durationSeconds: Math.round(elapsedMs / 1000),
    });
    router.refresh();
  };

  const handleAbort = async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    await abortLiveSession(sessionId);
    router.push(kind === "consultation" ? "/consultations" : "/appels");
  };

  return (
    <div className="flex flex-col gap-4">
      <ReplayHeader
        phase={phase}
        elapsedMs={elapsedMs}
        totalDurationMs={totalDurationMs}
        patientLabel={patientLabel}
        onStart={handleStart}
        onStop={handleStop}
        onAbort={handleAbort}
      />

      {phase === "finalizing" && (
        <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
          Finalisation de la session et lancement de l&apos;analyse…
        </div>
      )}

      <div className="grid h-[calc(100vh-220px)] min-h-[540px] grid-cols-12 gap-4">
        <div className="col-span-3 min-w-0">
          <LiveTranscript
            lines={visibleLines}
            interim=""
            showSpeaker
            footerNote={null}
            title="Transcription replay"
          />
        </div>
        <div className="col-span-6 min-w-0">
          <LiveFramework kind={kind} />
        </div>
        <div className="col-span-3 min-w-0">
          <CoachPanel
            bubbles={bubbles}
            pending={coachPending}
            enabled={phase === "playing"}
          />
        </div>
      </div>
    </div>
  );
}
