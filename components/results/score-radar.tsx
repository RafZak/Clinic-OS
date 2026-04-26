"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTranslations } from "next-intl";

export type RadarPoint = {
  step: number;
  label: string;
  score: number | null;
  rationale?: string | null;
};

export function ScoreRadar({ points }: { points: RadarPoint[] }) {
  const t = useTranslations("results");
  const data = points.map((p) => ({
    step: p.step,
    label: `${p.step}. ${p.label}`,
    short: p.label,
    score: p.score ?? 0,
    scoredDisplay: p.score,
    rationale: p.rationale ?? "",
    covered: p.score !== null,
  }));

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="rgba(0,0,0,0.08)" />
          <PolarAngleAxis
            dataKey="short"
            tick={{ fill: "#1A1A1A", fontSize: 11 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: "#6B7280", fontSize: 10 }}
            stroke="rgba(0,0,0,0.06)"
            axisLine={false}
            tickCount={5}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#CC0641"
            strokeWidth={2}
            fill="#CC0641"
            fillOpacity={0.18}
            isAnimationActive
          />
          <Tooltip
            content={
              <RadarTooltip
                scoreLabel={(score) => t("scoreOver", { score })}
                notEvaluated={t("stepNotEvaluated")}
              />
            }
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

type RadarTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: {
      label: string;
      scoredDisplay: number | null;
      rationale: string;
      covered: boolean;
    };
  }>;
  scoreLabel?: (score: number) => string;
  notEvaluated?: string;
};

function RadarTooltip({
  active,
  payload,
  scoreLabel,
  notEvaluated,
}: RadarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="max-w-xs rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-ink">{p.label}</div>
      <div className="mt-0.5 text-muted-foreground">
        {p.covered && p.scoredDisplay !== null && scoreLabel
          ? scoreLabel(p.scoredDisplay)
          : notEvaluated ?? ""}
      </div>
      {p.rationale && (
        <div className="mt-1 text-ink/80 leading-snug">{p.rationale}</div>
      )}
    </div>
  );
}
