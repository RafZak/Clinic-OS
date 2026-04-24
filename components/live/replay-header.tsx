"use client";

import { Play, Square, XOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export type ReplayPhase = "idle" | "playing" | "ended" | "finalizing";

export function ReplayHeader({
  phase,
  elapsedMs,
  totalDurationMs,
  patientLabel,
  onStart,
  onStop,
  onAbort,
}: {
  phase: ReplayPhase;
  elapsedMs: number;
  totalDurationMs: number;
  patientLabel: string;
  onStart: () => void;
  onStop: () => void;
  onAbort: () => void;
}) {
  const playing = phase === "playing";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex size-2.5 rounded-full ${
            playing ? "bg-brand animate-pulse" : "bg-border"
          }`}
          aria-hidden
        />
        <span className="font-mono text-lg tabular-nums text-ink">
          {formatElapsed(elapsedMs)}{" "}
          <span className="text-muted-foreground">
            / {formatElapsed(totalDurationMs)}
          </span>
        </span>
        <span className="text-sm text-muted-foreground">
          Replay · {patientLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {phase === "idle" && (
          <>
            <Button size="sm" variant="outline" onClick={onAbort}>
              <XOctagon className="size-4" aria-hidden />
              Abandonner
            </Button>
            <Button
              size="sm"
              className="bg-brand text-primary-foreground hover:bg-brand-dark"
              onClick={onStart}
            >
              <Play className="size-4" aria-hidden />
              Démarrer le replay
            </Button>
          </>
        )}
        {(phase === "playing" || phase === "ended") && (
          <>
            <Button size="sm" variant="outline" onClick={onAbort}>
              <XOctagon className="size-4" aria-hidden />
              Abandonner
            </Button>
            <Button
              size="sm"
              className="bg-brand text-primary-foreground hover:bg-brand-dark"
              onClick={onStop}
              disabled={phase === "ended"}
            >
              <Square className="size-4" aria-hidden />
              {phase === "ended" ? "Lecture terminée" : "Arrêter et analyser"}
            </Button>
          </>
        )}
        {phase === "finalizing" && (
          <span className="text-sm text-muted-foreground">Analyse en cours…</span>
        )}
      </div>
    </div>
  );
}
