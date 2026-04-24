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
