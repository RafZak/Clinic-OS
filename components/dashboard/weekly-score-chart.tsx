"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyScorePoint } from "@/lib/dashboard";

export function WeeklyScoreChart({
  points,
  yLabel = "Score moyen",
}: {
  points: WeeklyScorePoint[];
  yLabel?: string;
}) {
  const data = points.map((p) => ({
    name: p.weekLabel,
    score: p.avgScore,
    consultations: p.consultations,
  }));

  const hasData = data.some((d) => d.score != null);

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-border bg-surface-muted text-sm text-muted-foreground">
        Pas encore assez de sessions analysées sur 4 semaines.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "var(--brand)", strokeOpacity: 0.15 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid rgba(0,0,0,0.09)",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (name === "score") {
                return [value == null ? "—" : `${value}/100`, yLabel];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `Semaine ${label}`}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--brand)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "var(--brand)", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
