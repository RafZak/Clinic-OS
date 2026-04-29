"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CalendarGrid, UpcomingAppointment } from "@/lib/dashboard";
import type { Locale } from "@/lib/locale";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<UpcomingAppointment["patientStatus"], string> = {
  prospect: "bg-amber-500",
  patient: "bg-emerald-500",
  lost: "bg-red-500",
};

type DayCell = {
  isoDate: string;
  date: Date;
  dayNumber: number;
  inPrimaryMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  appointments: UpcomingAppointment[];
};

function buildGrid(grid: CalendarGrid): DayCell[] {
  const primaryMonth = new Date(grid.primaryMonthStart);
  const gridStart = new Date(grid.gridStart);
  const monthIndex = primaryMonth.getUTCMonth();

  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${String(
    today.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const todayMidnight = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );

  const byDay = new Map<string, UpcomingAppointment[]>();
  for (const apt of grid.appointments) {
    const d = new Date(apt.scheduledFor);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const arr = byDay.get(key) ?? [];
    arr.push(apt);
    byDay.set(key, arr);
  }

  const cells: DayCell[] = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
    cells.push({
      isoDate: key,
      date: d,
      dayNumber: d.getUTCDate(),
      inPrimaryMonth: d.getUTCMonth() === monthIndex,
      isToday: key === todayKey,
      isPast: d.getTime() < todayMidnight,
      appointments: (byDay.get(key) ?? []).sort((a, b) =>
        a.scheduledFor.localeCompare(b.scheduledFor)
      ),
    });
  }
  return cells;
}

function formatTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale === "en" ? "en-GB" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatLongDate(d: Date, locale: Locale): string {
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatMonthYear(d: Date, locale: Locale): string {
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function densityClass(count: number, isPast: boolean): string {
  if (count === 0) return "";
  if (isPast) return "ring-1 ring-inset ring-border/60 bg-surface-muted/40";
  if (count === 1) return "ring-1 ring-inset ring-amber-300 bg-amber-50/70";
  return "ring-1 ring-inset ring-brand/40 bg-brand/5";
}

export function MiniCalendar({
  grid,
  locale,
}: {
  grid: CalendarGrid;
  locale: Locale;
}) {
  const t = useTranslations("calendar");
  const cells = React.useMemo(() => buildGrid(grid), [grid]);
  const monthDate = new Date(grid.primaryMonthStart);
  const monthLabel = formatMonthYear(monthDate, locale);

  const totalUpcoming = cells
    .filter((c) => !c.isPast)
    .reduce((acc, c) => acc + c.appointments.length, 0);

  const [openDay, setOpenDay] = React.useState<DayCell | null>(null);

  const dayLabels = locale === "en"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex h-full flex-col">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("title")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t("monthLabel", { month: monthLabel, count: totalUpcoming })}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {dayLabels.map((d, i) => (
            <div key={`${d}-${i}`} className="px-1 py-1 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-1 grid flex-1 grid-cols-7 grid-rows-5 gap-1">
          {cells.map((cell) => {
            const count = cell.appointments.length;
            const interactive = count > 0;
            const trigger = (
              <button
                type="button"
                onClick={() => interactive && setOpenDay(cell)}
                disabled={!interactive}
                className={cn(
                  "group relative flex aspect-square w-full flex-col items-start justify-between rounded-md border border-transparent px-1.5 py-1 text-left transition-colors",
                  cell.inPrimaryMonth
                    ? "text-foreground"
                    : "text-muted-foreground/60",
                  cell.isPast && !cell.isToday && "opacity-60",
                  interactive &&
                    "cursor-pointer hover:border-border hover:bg-surface-muted",
                  !interactive && "cursor-default",
                  cell.isToday && "border-brand/60",
                  densityClass(count, cell.isPast)
                )}
                aria-label={
                  interactive
                    ? t("dayAria", {
                        date: formatLongDate(cell.date, locale),
                        count,
                      })
                    : formatLongDate(cell.date, locale)
                }
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums leading-none",
                    cell.isToday && "text-brand"
                  )}
                >
                  {cell.dayNumber}
                </span>
                {count > 0 && (
                  <div className="flex items-end gap-0.5">
                    {cell.appointments.slice(0, 3).map((apt) => (
                      <span
                        key={apt.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          STATUS_DOT[apt.patientStatus],
                          cell.isPast && "opacity-50"
                        )}
                      />
                    ))}
                    {count > 3 && (
                      <span className="ml-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                        +{count - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );

            if (!interactive) return <div key={cell.isoDate}>{trigger}</div>;

            return (
              <Tooltip key={cell.isoDate}>
                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider opacity-70">
                      {formatLongDate(cell.date, locale)}
                    </span>
                    {cell.appointments.slice(0, 4).map((apt) => (
                      <span key={apt.id} className="truncate">
                        {formatTime(apt.scheduledFor, locale)} · {apt.patientLabel}
                      </span>
                    ))}
                    {cell.appointments.length > 4 && (
                      <span className="opacity-70">
                        {t("moreAppointments", {
                          count: cell.appointments.length - 4,
                        })}
                      </span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {totalUpcoming === 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t("empty")}
          </p>
        )}

        <Sheet
          open={openDay != null}
          onOpenChange={(open) => !open && setOpenDay(null)}
        >
          <SheetContent>
            {openDay && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-brand" />
                    <SheetTitle>
                      {formatLongDate(openDay.date, locale)}
                    </SheetTitle>
                  </div>
                  <SheetDescription>
                    {t("sheetDescription", {
                      count: openDay.appointments.length,
                    })}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-2 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
                  {openDay.appointments.map((apt) => (
                    <Link
                      key={apt.id}
                      href={`/patients/${apt.patientId}`}
                      onClick={() => setOpenDay(null)}
                      className="group flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5 transition-colors hover:border-brand/40 hover:bg-surface-muted"
                    >
                      <div className="flex flex-col items-center pt-0.5">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatTime(apt.scheduledFor, locale)}
                        </span>
                        <span
                          className={cn(
                            "mt-1 h-1.5 w-1.5 rounded-full",
                            STATUS_DOT[apt.patientStatus]
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {apt.patientLabel}
                        </p>
                        {apt.summary && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {apt.summary}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{t(`status.${apt.patientStatus}`)}</span>
                          {apt.durationMinutes != null && (
                            <>
                              <span>·</span>
                              <span>{t("durationMin", { n: apt.durationMinutes })}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand" />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
