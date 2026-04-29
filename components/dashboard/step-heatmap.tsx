import { cn } from "@/lib/utils";
import type { StepHeatmapCell } from "@/lib/dashboard";

function fillClass(score: number | null): string {
  if (score == null) return "bg-surface-muted";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function pillClass(score: number | null): string {
  if (score == null) return "bg-surface-muted text-muted-foreground";
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-amber-100 text-amber-700";
  if (score >= 40) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
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
    <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {cells.map((cell, index) => {
        const score = cell.avgScore;
        const widthPct =
          score != null ? Math.max(2, Math.min(100, score)) : 0;
        const displayNumber = index + 1;
        return (
          <li
            key={cell.number}
            className="flex items-center gap-2.5 text-xs"
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
                pillClass(score)
              )}
            >
              {displayNumber}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {cell.name}
            </span>
            <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-muted">
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
                "w-7 shrink-0 text-right text-sm font-semibold tabular-nums",
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
