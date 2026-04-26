import { cn } from "@/lib/utils";
import type { StepHeatmapCell } from "@/lib/dashboard";

function fillClass(score: number | null): string {
  if (score == null) return "bg-surface-muted";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function scoreTextClass(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  if (score >= 40) return "text-orange-700";
  return "text-red-700";
}

export function StepHeatmap({ cells }: { cells: StepHeatmapCell[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {cells.map((cell, index) => {
        const score = cell.avgScore;
        const widthPct =
          score != null ? Math.max(2, Math.min(100, score)) : 0;
        const displayNumber = index + 1;
        return (
          <li
            key={cell.number}
            className="flex items-center gap-3 text-xs"
          >
            <span className="w-6 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {String(displayNumber).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {cell.name}
            </span>
            <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-surface-muted sm:w-32">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  fillClass(score)
                )}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span
              className={cn(
                "w-10 shrink-0 text-right text-sm font-semibold tabular-nums",
                scoreTextClass(score)
              )}
            >
              {score != null ? score : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
