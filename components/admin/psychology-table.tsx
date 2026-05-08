"use client";

import { useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";
import { PsychologyRadar } from "@/components/patients/psychology-radar";
import type { PsyExportRow } from "@/lib/psychology/format-csv";

type Props = {
  rows: PsyExportRow[];
  consentMode: "active" | "all";
};

export function PsychologyTable({ rows, consentMode }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(rows.map((r) => r.patientId))
  );
  const allSelected = selected.size === rows.length && rows.length > 0;

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.patientId)));

  const exportCsv = () => {
    if (consentMode === "all") {
      const ok = window.confirm(
        "Vous incluez des patients non-consentants. Cet export ne peut PAS être utilisé en marketing direct (sanctions RGPD). Confirmer ?"
      );
      if (!ok) return;
    }
    const url = new URL("/admin/psychology/export", window.location.origin);
    url.searchParams.set("ids", [...selected].join(","));
    url.searchParams.set("consent", consentMode);
    window.location.href = url.toString();
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      {consentMode === "all" && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Mode <strong>« tous »</strong> activé. Les patients sans
            consentement marketing actif sont inclus. Vous ne pouvez pas
            utiliser ce fichier en campagne marketing.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm">
          {selected.size} / {rows.length} sélectionné
          {selected.size > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exporter CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Tout sélectionner"
              />
            </th>
            <th className="px-4 py-2">Patient</th>
            <th className="px-4 py-2">Centre</th>
            <th className="px-4 py-2">Dernière session</th>
            <th className="px-4 py-2">Tags</th>
            <th className="px-4 py-2">Radar</th>
            <th className="px-4 py-2">Consent.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.patientId}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(r.patientId)}
                  onChange={() => toggle(r.patientId)}
                />
              </td>
              <td className="px-4 py-2 font-medium">{r.fullName}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {r.centerName ?? "—"}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {r.lastSessionDate
                  ? r.lastSessionDate.toLocaleDateString("fr-FR")
                  : "—"}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand"
                    >
                      {PSY_TAG_LABEL[t as PsyTag]}
                    </span>
                  ))}
                  {r.tags.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{r.tags.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2">
                <PsychologyRadar
                  size={48}
                  showLabels={false}
                  layers={[
                    {
                      key: "g",
                      radar: r.globalRadar,
                      color: "#CC0641",
                      fillOpacity: 0.3,
                      strokeWidth: 1.5,
                    },
                  ]}
                />
              </td>
              <td className="px-4 py-2">
                {r.consentAt ? (
                  <span className="text-emerald-700">
                    ✓ {r.consentAt.toLocaleDateString("fr-FR")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                Aucun patient ne correspond aux filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
