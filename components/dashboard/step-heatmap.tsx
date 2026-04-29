import { getTranslations } from "next-intl/server";
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

function StepRow({ cell, displayNumber }: { cell: StepHeatmapCell; displayNumber: number }) {
  const score = cell.avgScore;
  const widthPct =
    score != null ? Math.max(2, Math.min(100, score)) : 0;
  return (
    <li className="flex items-center gap-2.5 text-xs">
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
}

export async function StepHeatmap({ cells }: { cells: StepHeatmapCell[] }) {
  const t = await getTranslations("heatmap");
  const indexed = cells.map((cell, index) => ({
    cell,
    displayNumber: index + 1,
  }));
  const half = Math.ceil(indexed.length / 2);
  const left = indexed.slice(0, half);
  const right = indexed.slice(half);

  const scored = indexed.filter((c) => c.cell.avgScore != null);
  const strongest =
    scored.length > 0
      ? scored.reduce((a, b) =>
          (a.cell.avgScore ?? 0) >= (b.cell.avgScore ?? 0) ? a : b
        )
      : null;
  const weakest =
    scored.length > 0
      ? scored.reduce((a, b) =>
          (a.cell.avgScore ?? 0) <= (b.cell.avgScore ?? 0) ? a : b
        )
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="grid flex-1 grid-cols-1 content-around gap-x-6 gap-y-3 sm:grid-cols-2">
        <ul className="flex flex-col justify-around gap-3">
          {left.map(({ cell, displayNumber }) => (
            <StepRow
              key={cell.number}
              cell={cell}
              displayNumber={displayNumber}
            />
          ))}
        </ul>
        <ul className="flex flex-col justify-around gap-3">
          {right.map(({ cell, displayNumber }) => (
            <StepRow
              key={cell.number}
              cell={cell}
              displayNumber={displayNumber}
            />
          ))}
        </ul>
      </div>

      {strongest && weakest && strongest !== weakest && (
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
                pillClass(strongest.cell.avgScore)
              )}
            >
              {strongest.displayNumber}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("strongest")}
              </p>
              <p className="truncate text-xs font-medium text-foreground">
                {strongest.cell.name}{" "}
                <span
                  className={cn(
                    "tabular-nums",
                    scoreTextClass(strongest.cell.avgScore)
                  )}
                >
                  · {strongest.cell.avgScore}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
                pillClass(weakest.cell.avgScore)
              )}
            >
              {weakest.displayNumber}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("weakest")}
              </p>
              <p className="truncate text-xs font-medium text-foreground">
                {weakest.cell.name}{" "}
                <span
                  className={cn(
                    "tabular-nums",
                    scoreTextClass(weakest.cell.avgScore)
                  )}
                >
                  · {weakest.cell.avgScore}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
