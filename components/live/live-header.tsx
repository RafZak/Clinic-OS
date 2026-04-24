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
