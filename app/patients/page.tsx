import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PatientsTable } from "@/components/patients/patients-table";
import { listPatients, type PatientStatus } from "@/lib/patients";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TABS: { value: "all" | PatientStatus; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "prospect", label: "Prospects" },
  { value: "patient", label: "Gagnés" },
  { value: "lost", label: "Perdus" },
];

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

      <PatientsTable rows={rows} />
    </div>
  );
}
