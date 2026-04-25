import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { RecentSessionRow } from "@/lib/dashboard";
import { formatDuration, scoreTextColor } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}


export function RecentSessionsTable({
  rows,
  kind,
}: {
  rows: RecentSessionRow[];
  kind: "consultation" | "phone_call";
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-muted-foreground">
        Aucune session analysée pour l&apos;instant.
      </div>
    );
  }

  const baseHref = kind === "consultation" ? "/consultations" : "/appels";
  const labelKind = kind === "consultation" ? "Consultation" : "Appel";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Patient</th>
            <th className="px-4 py-2.5 text-left font-medium">Pro</th>
            <th className="px-4 py-2.5 text-left font-medium">Score</th>
            <th className="px-4 py-2.5 text-left font-medium">Durée</th>
            <th className="px-4 py-2.5 text-left font-medium">Date</th>
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
                {formatRelative(r.startedAt)}
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
