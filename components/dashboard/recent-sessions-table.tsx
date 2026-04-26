import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import type { RecentSessionRow } from "@/lib/dashboard";
import { formatDuration, scoreTextColor } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatRelative(
  date: Date | null,
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (!date) return "—";
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 7) return t("daysAgo", { n: days });
  if (days < 30) return t("weeksAgo", { n: Math.floor(days / 7) });
  return date.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

export async function RecentSessionsTable({
  rows,
  kind,
}: {
  rows: RecentSessionRow[];
  kind: "consultation" | "phone_call";
}) {
  const t = await getTranslations("recentSessions");
  const locale = await getLocale();

  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  const baseHref = kind === "consultation" ? "/consultations" : "/appels";
  const labelKind = kind === "consultation" ? t("consultation") : t("phone_call");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">{t("patient")}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t("pro")}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t("score")}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t("duration")}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t("date")}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border last:border-b-0 transition-colors hover:bg-surface-muted"
            >
              <td className="px-4 py-2.5 font-medium">{r.patientLabel}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {r.practitionerName ?? "—"}
                {r.centerName && (
                  <span className="ml-1 text-xs opacity-70">· {r.centerName}</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className={cn("font-semibold", scoreTextColor(r.globalScore))}>
                  {r.globalScore != null ? `${r.globalScore}/100` : "—"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {formatDuration(r.durationSeconds)}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {formatRelative(r.startedAt, locale, t)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  href={`${baseHref}/${r.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
                >
                  {labelKind} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
