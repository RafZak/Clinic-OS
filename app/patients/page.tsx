import Link from "next/link";
import { ArrowUpRight, Phone, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  listPatients,
  STATUS_LABEL,
  type PatientRow,
  type PatientStatus,
} from "@/lib/patients";
import {
  LEAD_TEMPERATURE_LABEL,
  type LeadTemperature,
} from "@/lib/phone-tags";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TABS: { value: "all" | PatientStatus; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "prospect", label: "Prospects" },
  { value: "patient", label: "Gagnés" },
  { value: "lost", label: "Perdus" },
];

const STATUS_BADGE_CLASS: Record<PatientStatus, string> = {
  prospect: "bg-surface-muted text-foreground border-border",
  patient: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

const TEMPERATURE_BADGE_CLASS: Record<LeadTemperature, string> = {
  hot: "bg-red-50 text-red-700 border-red-200",
  warm: "bg-amber-50 text-amber-700 border-amber-200",
  cold: "bg-sky-50 text-sky-700 border-sky-200",
  lost: "bg-slate-100 text-slate-600 border-slate-300",
};

function initials(label: string): string {
  const parts = label.replace(/^(M\.|Mme|Mlle)\s+/i, "").split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem`;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const filterRaw = params.status ?? "all";
  const filter: "all" | PatientStatus = (
    ["prospect", "patient", "lost"] as const
  ).includes(filterRaw as PatientStatus)
    ? (filterRaw as PatientStatus)
    : "all";

  const all = await listPatients();
  const counts: Record<"all" | PatientStatus, number> = {
    all: all.length,
    prospect: all.filter((p) => p.status === "prospect").length,
    patient: all.filter((p) => p.status === "patient").length,
    lost: all.filter((p) => p.status === "lost").length,
  };
  const rows = filter === "all" ? all : all.filter((p) => p.status === filter);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patients"
        description="Parcours complet de chaque patient : appels, consultations, essais, livraisons et suivis."
      />

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
        {STATUS_TABS.map((tab) => {
          const active = filter === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/patients" : `/patients?status=${tab.value}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand text-white"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              )}
            >
              {tab.label}{" "}
              <span
                className={cn(
                  "ml-1 text-xs",
                  active ? "text-white/80" : "text-muted-foreground"
                )}
              >
                {counts[tab.value]}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted-foreground">
          Aucun patient dans cette catégorie.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Patient</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-left font-medium">Température</th>
                <th className="px-4 py-3 text-left font-medium">Centre</th>
                <th className="px-4 py-3 text-left font-medium">Parcours</th>
                <th className="px-4 py-3 text-left font-medium">
                  Score consult. moyen
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Dernière interaction
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PatientTableRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PatientTableRow({ p }: { p: PatientRow }) {
  return (
    <tr className="border-b border-border last:border-b-0 transition-colors hover:bg-surface-muted">
      <td className="px-4 py-3">
        <Link
          href={`/patients/${p.id}`}
          className="flex items-center gap-3 font-medium hover:text-brand"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-muted-foreground">
            {initials(p.label)}
          </div>
          <div className="flex flex-col">
            <span>{p.label}</span>
            {p.age != null && (
              <span className="text-xs text-muted-foreground">{p.age} ans</span>
            )}
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            STATUS_BADGE_CLASS[p.status]
          )}
        >
          {STATUS_LABEL[p.status]}
        </span>
      </td>
      <td className="px-4 py-3">
        {p.lastPhoneTemperature ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              TEMPERATURE_BADGE_CLASS[p.lastPhoneTemperature]
            )}
          >
            {LEAD_TEMPERATURE_LABEL[p.lastPhoneTemperature]}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{p.centerName ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Consultations">
            <Stethoscope className="h-3.5 w-3.5" />
            {p.consultationsCount}
          </span>
          <span className="inline-flex items-center gap-1" title="Appels téléphoniques">
            <Phone className="h-3.5 w-3.5" />
            {p.phoneCallsCount}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        {p.avgConsultationScore != null ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold">{p.avgConsultationScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatRelative(p.lastEventAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/patients/${p.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
        >
          Voir <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}
