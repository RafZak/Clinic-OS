"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Phone, Stethoscope, Trash2, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { DeletePatientsDialog } from "@/components/patients/delete-patients-dialog";
import {
  STATUS_LABEL,
  STATUS_LABEL_EN,
  type PatientRow,
  type PatientStatus,
} from "@/lib/patients-shared";
import {
  LEAD_TEMPERATURE_LABEL,
  LEAD_TEMPERATURE_LABEL_EN,
  type LeadTemperature,
} from "@/lib/phone-tags";
import { cn } from "@/lib/utils";

const STATUS_BADGE_CLASS: Record<PatientStatus, string> = {
  prospect: "bg-surface-muted text-foreground border-border",
  patient: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

const TEMPERATURE_LEVEL: Record<LeadTemperature, number> = {
  hot: 3,
  warm: 2,
  cold: 1,
  lost: 0,
};

const TEMPERATURE_TONE: Record<LeadTemperature, { dot: string; text: string }> = {
  hot: { dot: "bg-red-500", text: "text-red-700" },
  warm: { dot: "bg-amber-500", text: "text-amber-700" },
  cold: { dot: "bg-sky-500", text: "text-sky-700" },
  lost: { dot: "bg-slate-400", text: "text-slate-500" },
};

function TemperatureIndicator({
  temperature,
  label,
}: {
  temperature: LeadTemperature;
  label: string;
}) {
  const level = TEMPERATURE_LEVEL[temperature];
  const tone = TEMPERATURE_TONE[temperature];
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              i < level ? tone.dot : "bg-slate-200"
            )}
          />
        ))}
      </span>
      <span className={cn("text-xs font-medium", tone.text)}>{label}</span>
    </span>
  );
}

function initials(label: string): string {
  const parts = label.replace(/^(M\.|Mme|Mlle|Mr\.|Mrs\.|Ms\.)\s+/i, "").split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function PatientsTable({ rows }: { rows: PatientRow[] }) {
  const t = useTranslations("patients");
  const tRecent = useTranslations("recentSessions");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && selected.size < allIds.length;

  const statusMap = locale === "en" ? STATUS_LABEL_EN : STATUS_LABEL;
  const tempMap = locale === "en" ? LEAD_TEMPERATURE_LABEL_EN : LEAD_TEMPERATURE_LABEL;

  function formatRelative(date: Date | null): string {
    if (!date) return "—";
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return tRecent("today");
    if (diffDays === 1) return tRecent("yesterday");
    if (diffDays < 7) return tRecent("daysAgo", { n: diffDays });
    if (diffDays < 30) return tRecent("weeksAgo", { n: Math.floor(diffDays / 7) });
    return date.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label={t("filterAll")}
                  className="h-4 w-4 cursor-pointer accent-brand"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 text-left font-medium">{t("tableLabel")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("tableStatus")}</th>
              <th className="px-4 py-3 text-left font-medium">
                {locale === "en" ? "Temperature" : "Température"}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {locale === "en" ? "Center" : "Centre"}
              </th>
              <th className="px-4 py-3 text-left font-medium">{t("timelineTitle")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("tableScore")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("tableLast")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const checked = selected.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b border-border last:border-b-0 transition-colors hover:bg-surface-muted",
                    checked && "bg-surface-muted"
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={p.label}
                      className="h-4 w-4 cursor-pointer accent-brand"
                      checked={checked}
                      onChange={() => toggleOne(p.id)}
                    />
                  </td>
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
                          <span className="text-xs text-muted-foreground">
                            {locale === "en" ? `${p.age} y/o` : `${p.age} ans`}
                          </span>
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
                      {statusMap[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.lastPhoneTemperature ? (
                      <TemperatureIndicator
                        temperature={p.lastPhoneTemperature}
                        label={tempMap[p.lastPhoneTemperature]}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.centerName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span
                        className="inline-flex items-center gap-1"
                        title={locale === "en" ? "Consultations" : "Consultations"}
                      >
                        <Stethoscope className="h-3.5 w-3.5" />
                        {p.consultationsCount}
                      </span>
                      <span
                        className="inline-flex items-center gap-1"
                        title={locale === "en" ? "Inbound calls" : "Appels téléphoniques"}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {p.phoneCallsCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.avgConsultationScore != null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {p.avgConsultationScore}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          /100
                        </span>
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
                      {locale === "en" ? "View" : "Voir"}{" "}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-foreground/95 px-4 py-2 text-sm text-white shadow-lg backdrop-blur">
            <span className="font-medium">
              {locale === "en"
                ? `${selected.size} ${selected.size > 1 ? "patients selected" : "patient selected"}`
                : `${selected.size} patient${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`}
            </span>
            <span className="h-4 w-px bg-white/30" aria-hidden />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-white hover:bg-white/10 hover:text-white"
              onClick={clearSelection}
            >
              <X className="h-3.5 w-3.5" />
              {t("deleteCancel")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("deleteOne")}
            </Button>
          </div>
        </div>
      )}

      <DeletePatientsDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        patientIds={selectedIds}
        onDeleted={() => {
          clearSelection();
          router.refresh();
        }}
      />
    </>
  );
}
