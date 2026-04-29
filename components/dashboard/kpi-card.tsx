"use client";

import * as React from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import {
  Activity,
  Clock,
  Headphones,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DashboardKpiKind, WeeklyScorePoint } from "@/lib/dashboard";
import type { ScoreTone } from "@/lib/score-tone";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<DashboardKpiKind, LucideIcon> = {
  conversion: Target,
  basket: Wallet,
  score: Activity,
  callDuration: Clock,
  callScore: Headphones,
};

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
  spark,
}: {
  kind: DashboardKpiKind;
  label: string;
  value: string;
  hint?: string;
  tone?: ScoreTone;
  spark?: WeeklyScorePoint[];
}) {
  const Icon = KIND_ICON[kind];
  const styles = TONE_STYLES[tone];
  const sparkData = spark
    ? spark
        .map((p, i) => ({ i, score: p.avgScore }))
        .filter((p) => p.score != null)
    : [];
  const showSpark = sparkData.length >= 2;

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
        {showSpark && (
          <div className="h-9 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sparkData}
                margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
              >
                <YAxis hide domain={[0, 100]} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {hint && (
        <p className="line-clamp-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
