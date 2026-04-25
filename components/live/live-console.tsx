"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FrameworkKind } from "@/lib/frameworks";
import { useDeepgramLive } from "@/hooks/use-deepgram-live";
import { useLiveCoach } from "@/hooks/use-live-coach";
import { finishLiveSession, abortLiveSession } from "@/app/actions/sessions";
import { LiveHeader } from "./live-header";
import { LiveTranscript } from "./live-transcript";
import { LiveFramework } from "./live-framework";
import { CoachPanel } from "./coach-panel";

export function LiveConsole({
  sessionId,
  kind,
}: {
  sessionId: string;
  kind: FrameworkKind;
}) {
  const router = useRouter();
  const { state, lines, interim, latencyMs, start, stop } = useDeepgramLive({ sessionId });
  const { bubbles, pending: coachPending } = useLiveCoach({
    sessionId,
    kind,
    lines,
    enabled: state.phase === "recording",
  });
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
          Upload de l&apos;audio et finalisation de la session…
        </div>
      )}

      <div className="grid h-[calc(100vh-220px)] min-h-[540px] grid-cols-12 gap-4">
        <div className="col-span-3 min-w-0">
          <LiveTranscript
            lines={lines}
            interim={interim}
            practitionerLabel={kind === "phone_call" ? "Standardiste" : "Pro"}
            patientLabel={kind === "phone_call" ? "Appelant" : "Patient"}
          />
        </div>
        <div className="col-span-6 min-w-0">
          <LiveFramework kind={kind} />
        </div>
        <div className="col-span-3 min-w-0">
          <CoachPanel
            bubbles={bubbles}
            pending={coachPending}
            enabled={state.phase === "recording"}
          />
        </div>
      </div>
    </div>
  );
}
