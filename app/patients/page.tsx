import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { PatientsTable } from "@/components/patients/patients-table";
import { listPatients, type PatientStatus } from "@/lib/patients";
import { getLocale } from "@/lib/locale";
import { PSY_TAGS, type PsyTag } from "@/lib/psychology/tags";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TABS: {
  value: "all" | PatientStatus;
  labelKey: "filterAll" | "filterProspect" | "filterPatient" | "filterLost";
}[] = [
  { value: "all", labelKey: "filterAll" },
  { value: "prospect", labelKey: "filterProspect" },
  { value: "patient", labelKey: "filterPatient" },
  { value: "lost", labelKey: "filterLost" },
];

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tags?: string; consent?: string }>;
}) {
  const t = await getTranslations("patients");
  const locale = await getLocale();
  const params = await searchParams;

  const filterRaw = params.status ?? "all";
  const filter: "all" | PatientStatus = (
    ["prospect", "patient", "lost"] as const
  ).includes(filterRaw as PatientStatus)
    ? (filterRaw as PatientStatus)
    : "all";

  const selectedTags = (params.tags?.split(",").filter(Boolean) ?? []).filter(
    (t): t is PsyTag => (PSY_TAGS as ReadonlyArray<string>).includes(t)
  );
  const consentMode: "any" | "active" | "missing" =
    params.consent === "active"
      ? "active"
      : params.consent === "missing"
        ? "missing"
        : "any";

  const all = await listPatients(locale);
  const counts: Record<"all" | PatientStatus, number> = {
    all: all.length,
    prospect: all.filter((p) => p.status === "prospect").length,
    patient: all.filter((p) => p.status === "patient").length,
    lost: all.filter((p) => p.status === "lost").length,
  };

  let rows = filter === "all" ? all : all.filter((p) => p.status === filter);

  if (selectedTags.length > 0) {
    rows = rows.filter((p) =>
      selectedTags.some((tag) => p.psyTags.includes(tag))
    );
  }

  if (consentMode === "active") {
    rows = rows.filter((p) => p.marketingConsentActive);
  } else if (consentMode === "missing") {
    rows = rows.filter((p) => !p.marketingConsentActive);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
        {STATUS_TABS.map((tab) => {
          const active = filter === tab.value;
          // preserve existing tags/consent params when switching status tab
          const sp = new URLSearchParams();
          if (tab.value !== "all") sp.set("status", tab.value);
          if (selectedTags.length > 0) sp.set("tags", selectedTags.join(","));
          if (consentMode !== "any") sp.set("consent", consentMode);
          const href = sp.toString() ? `/patients?${sp.toString()}` : "/patients";
          return (
            <Link
              key={tab.value}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand text-white"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              )}
            >
              {t(tab.labelKey)}{" "}
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

      <PatientsTable
        rows={rows}
        selectedTags={selectedTags}
        consentMode={consentMode}
        statusFilter={filter}
      />
    </div>
  );
}
