"use client";

import * as React from "react";
import {
  Activity,
  Clock,
  Headphones,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DashboardKpiKind } from "@/lib/dashboard";
import type { ScoreTone } from "@/lib/score-tone";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<DashboardKpiKind, LucideIcon> = {
  conversion: Target,
  basket: Wallet,
  score: Activity,
  callDuration: Clock,
  callScore: Headphones,
};

const RING_STROKE: Record<ScoreTone, string> = {
  neutral: "stroke-muted-foreground/40",
  success: "stroke-emerald-500",
  warning: "stroke-amber-500",
  danger: "stroke-red-500",
};

function ScoreRing({
  score,
  tone,
}: {
  score: number | null;
  tone: ScoreTone;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - pct);

  return (
    <svg
      viewBox="0 0 64 64"
      className="h-16 w-16 shrink-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        className="stroke-surface-muted"
        strokeWidth={5}
      />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        className={cn(
          "transition-[stroke-dashoffset] duration-700",
          RING_STROKE[tone]
        )}
        strokeWidth={5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

const TONE_STYLES: Record<
  ScoreTone,
  { iconBg: string; iconColor: string; ring: string }
> = {
  neutral: {
    iconBg: "bg-surface-muted",
    iconColor: "text-foreground",
    ring: "",
  },
  success: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-700",
    ring: "",
  },
  warning: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-700",
    ring: "",
  },
  danger: {
    iconBg: "bg-red-50",
    iconColor: "text-red-700",
    ring: "",
  },
};

export function KpiCard({
  kind,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  kind: DashboardKpiKind;
  label: string;
  value: string;
  hint?: string;
  tone?: ScoreTone;
}) {
  const Icon = KIND_ICON[kind];
  const styles = TONE_STYLES[tone];

  const scoreMatch =
    kind === "score" || kind === "callScore"
      ? value.match(/^(\d+)\/100/)
      : null;
  const scoreNumber = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
  const showRing = scoreNumber != null;

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface p-4 transition-shadow",
        "hover:shadow-sm",
        styles.ring
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              styles.iconBg
            )}
          >
            <Icon className={cn("h-4 w-4", styles.iconColor)} />
          </span>
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="text-[26px] font-semibold leading-none tracking-tight">
          {value}
        </p>
        {showRing && <ScoreRing score={scoreNumber} tone={tone} />}
      </div>

      {hint && (
        <p className="line-clamp-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
