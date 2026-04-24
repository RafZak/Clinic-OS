"use client";

import { Sparkles, TrendingUp, AlertTriangle, Zap, ShieldAlert } from "lucide-react";
import type { CoachBubble } from "@/hooks/use-live-coach";

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function iconFor(type: CoachBubble["type"]) {
  switch (type) {
    case "missed_objection":
      return ShieldAlert;
    case "upsell_missed":
      return TrendingUp;
    case "good_practice":
      return Sparkles;
    case "improvement":
      return Zap;
    default:
      return AlertTriangle;
  }
}

function severityClasses(severity: CoachBubble["severity"]): {
  card: string;
  icon: string;
  pill: string;
  label: string;
} {
  switch (severity) {
    case "critical":
      return {
        card: "border-brand bg-brand/5",
        icon: "bg-brand/15 text-brand",
        pill: "bg-brand/15 text-brand",
        label: "Critique",
      };
    case "warning":
      return {
        card: "border-amber-300 bg-amber-50",
        icon: "bg-amber-100 text-amber-700",
        pill: "bg-amber-100 text-amber-700",
        label: "À surveiller",
      };
    default:
      return {
        card: "border-border bg-surface",
        icon: "bg-surface-muted text-muted-foreground",
        pill: "bg-surface-muted text-muted-foreground",
        label: "Info",
      };
  }
}

const TYPE_LABEL: Record<CoachBubble["type"], string> = {
  missed_objection: "Objection ratée",
  upsell_missed: "Upsell manqué",
  good_practice: "Bonne pratique",
  improvement: "À améliorer",
};

export function CoachPanel({
  bubbles,
  pending,
  enabled,
}: {
  bubbles: CoachBubble[];
  pending: boolean;
  enabled: boolean;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>Coach IA</span>
        <span className="flex items-center gap-1 tabular-nums">
          {pending && (
            <span className="inline-flex size-1.5 animate-pulse rounded-full bg-brand" aria-hidden />
          )}
          {bubbles.length} {bubbles.length <= 1 ? "bulle" : "bulles"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {bubbles.length === 0 ? (
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3 pt-4 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-ink">
              {enabled ? "Coach à l'écoute" : "Coach en veille"}
            </p>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "Les bulles apparaîtront au fil de la conversation quand un moment coachable est détecté."
                : "Démarrez la session pour activer le coaching en temps réel."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {bubbles.map((b) => {
              const s = severityClasses(b.severity);
              const Icon = iconFor(b.type);
              return (
                <li
                  key={b.id}
                  className={`animate-in fade-in slide-in-from-top-2 duration-300 rounded-md border p-3 ${s.card}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${s.icon}`}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink leading-tight">
                          {b.title}
                        </span>
                        {b.timestampMs != null && (
                          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                            {formatMs(b.timestampMs)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-ink/80">
                        {b.description}
                      </p>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${s.pill}`}
                        >
                          {s.label}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {TYPE_LABEL[b.type]}
                        </span>
                        {b.relatedStep != null && (
                          <span className="inline-flex items-center rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Étape {b.relatedStep}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
