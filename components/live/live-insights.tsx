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
