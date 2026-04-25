import Link from "next/link";
import { Sparkles, Stethoscope, PhoneIncoming } from "lucide-react";
import type {
  SidebarRecentPatient,
  SidebarRecentSession,
} from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<SidebarRecentPatient["status"], string> = {
  prospect: "bg-slate-400",
  patient: "bg-emerald-500",
  lost: "bg-red-500",
};

function initials(label: string): string {
  const parts = label.replace(/^(M\.|Mme|Mlle)\s+/i, "").split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function SidebarRecents({
  patients,
  lastSession,
}: {
  patients: SidebarRecentPatient[];
  lastSession: SidebarRecentSession | null;
}) {
  if (patients.length === 0 && !lastSession) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {patients.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Patients récents
          </p>
          <ul className="flex flex-col gap-0.5">
            {patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-muted-foreground">
                    {initials(p.label)}
                    <span
                      className={cn(
                        "absolute -bottom-0 -right-0 size-2 rounded-full ring-2 ring-surface",
                        STATUS_DOT[p.status]
                      )}
                      aria-hidden
                    />
                  </span>
                  <span className="truncate">{p.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastSession && (
        <div className="flex flex-col gap-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dernière analyse
          </p>
          <Link
            href={
              lastSession.kind === "consultation"
                ? `/consultations/${lastSession.id}`
                : `/appels/${lastSession.id}`
            }
            className="flex items-start gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {lastSession.kind === "consultation" ? (
              <Stethoscope className="mt-0.5 size-3.5 shrink-0 text-brand" />
            ) : (
              <PhoneIncoming className="mt-0.5 size-3.5 shrink-0 text-brand" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-ink">
                {lastSession.patientLabel}
              </span>
              {lastSession.globalScore != null && (
                <span className="inline-flex items-center gap-1 text-[10px]">
                  <Sparkles className="size-2.5" />
                  Score {lastSession.globalScore}/100
                </span>
              )}
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
