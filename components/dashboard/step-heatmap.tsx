import { cn } from "@/lib/utils";
import type { StepHeatmapCell } from "@/lib/dashboard";

function scoreClass(score: number | null): string {
  if (score == null) return "bg-surface-muted text-muted-foreground border-border";
  if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 60) return "bg-amber-50 text-amber-800 border-amber-200";
  if (score >= 40) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export function StepHeatmap({ cells }: { cells: StepHeatmapCell[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((cell) => {
        const klass = scoreClass(cell.avgScore);
        return (
          <div
            key={cell.number}
            className={cn(
              "flex flex-col gap-1 rounded-md border px-3 py-2.5 text-xs",
              klass
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] opacity-60">
                Étape {cell.number}
              </span>
              <span className="text-base font-semibold leading-none">
                {cell.avgScore != null ? cell.avgScore : "—"}
              </span>
            </div>
            <span className="line-clamp-2 leading-tight">{cell.name}</span>
          </div>
        );
      })}
    </div>
  );
}
