"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { PsyRadar, PsySnapshot } from "@/lib/psychology/axes";
import { PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";
import { PsychologyRadar } from "./psychology-radar";
import { cn } from "@/lib/utils";

type SessionKind = "consultation" | "phone_call";

const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  consultation: "Consultation",
  phone_call: "Appel entrant",
};

const SESSION_COLORS = [
  { color: "#9CA3AF", fillOpacity: 0.1, dasharray: "4 3" },
  { color: "#E96A8E", fillOpacity: 0.1, dasharray: "4 3" },
  { color: "#CC0641", fillOpacity: 0.2, dasharray: "4 3" },
] as const;

const GLOBAL_COLOR = "#CC0641";

export type PsychologyRadarCardProps = {
  globalRadar: PsyRadar;
  globalTags: PsyTag[];
  snapshots: Array<
    PsySnapshot & {
      sessionKind: SessionKind;
      sessionStartedAt: Date;
    }
  >;
};

type LegendEntry = {
  key: string;
  label: string;
  color: string;
  fillOpacity: number;
  strokeWidth: number;
  dasharray?: string;
};

function formatSessionDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function PsychologyRadarCard({
  globalRadar,
  globalTags,
  snapshots,
}: PsychologyRadarCardProps) {
  const [showHistory, setShowHistory] = useState(false);

  // snapshots input is DESC (most recent first). Take 3 most recent, then
  // reverse → oldest first for paint order.
  const visibleSnapshots = snapshots.slice(0, 3).reverse();
  const hiddenCount = Math.max(0, snapshots.length - 3);

  const paletteFor = (i: number) =>
    SESSION_COLORS[
      Math.max(0, SESSION_COLORS.length - visibleSnapshots.length + i)
    ];

  const layers = [
    ...(showHistory
      ? visibleSnapshots.map((snap, i) => {
          const palette = paletteFor(i);
          return {
            key: snap.id,
            radar: snap.radar,
            color: palette.color,
            fillOpacity: palette.fillOpacity,
            strokeWidth: 1.5,
            dasharray: palette.dasharray,
          };
        })
      : []),
    {
      key: "global",
      radar: globalRadar,
      color: GLOBAL_COLOR,
      fillOpacity: 0.3,
      strokeWidth: 2.5,
    },
  ];

  // Legend: global first, then sessions in REVERSE visible order
  // (most recent at top, oldest at bottom — feels chronologically natural).
  const legendEntries: LegendEntry[] = [
    {
      key: "global",
      label: "Global synthétisé",
      color: GLOBAL_COLOR,
      fillOpacity: 0.3,
      strokeWidth: 2.5,
    },
    ...(showHistory
      ? visibleSnapshots
          .map((snap, i) => {
            const palette = paletteFor(i);
            return {
              key: snap.id,
              label: `${SESSION_KIND_LABEL[snap.sessionKind]} · ${formatSessionDate(
                snap.sessionStartedAt
              )}`,
              color: palette.color,
              fillOpacity: palette.fillOpacity,
              strokeWidth: 1.5,
              dasharray: palette.dasharray,
            };
          })
          .reverse()
      : []),
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Profil psychologique
        </h3>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
            showHistory
              ? "border-brand/30 bg-brand/10 text-brand hover:bg-brand/15"
              : "border-border bg-white text-muted-foreground hover:bg-light"
          )}
          aria-pressed={showHistory}
        >
          {showHistory ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {showHistory ? "Masquer l'évolution" : "Afficher l'évolution"}
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,200px)] lg:items-center">
        <div className="flex justify-center">
          <PsychologyRadar layers={layers} size={300} />
        </div>

        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {legendEntries.map((entry) => (
              <li
                key={entry.key}
                className="flex items-center gap-2 text-xs text-foreground"
              >
                <LegendSwatch
                  color={entry.color}
                  fillOpacity={entry.fillOpacity}
                  strokeWidth={entry.strokeWidth}
                  dasharray={entry.dasharray}
                />
                <span className="leading-tight">{entry.label}</span>
              </li>
            ))}
          </ul>
          {showHistory && hiddenCount > 0 ? (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              {hiddenCount} session{hiddenCount > 1 ? "s" : ""} plus ancienne
              {hiddenCount > 1 ? "s" : ""} non affichée
              {hiddenCount > 1 ? "s" : ""}
            </p>
          ) : null}
        </div>
      </div>

      {globalTags.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {globalTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand"
            >
              {PSY_TAG_LABEL[tag]}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LegendSwatch({
  color,
  fillOpacity,
  strokeWidth,
  dasharray,
}: {
  color: string;
  fillOpacity: number;
  strokeWidth: number;
  dasharray?: string;
}) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x={1}
        y={1}
        width={12}
        height={12}
        rx={2}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
      />
    </svg>
  );
}
