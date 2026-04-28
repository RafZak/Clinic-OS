import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SidebarRecentPatient } from "@/lib/sidebar-context";
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

export async function SidebarRecents({
  patients,
}: {
  patients: SidebarRecentPatient[];
  /** lastSession est conservé en arg pour ne pas casser l'appelant, mais ignoré. */
  lastSession?: unknown;
}) {
  if (patients.length === 0) return null;

  const tNav = await getTranslations("nav");

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {tNav("patientsRecent")}
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
    </div>
  );
}
