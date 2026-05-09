"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import type { ExportFormat, ExportLocale } from "@/lib/psychology/export/types";

type Props = {
  /** Compte affiché dans le bouton (ex: "Exporter (12)"). */
  exportableCount: number;
  /** Construit l'URL pour un (format, locale) donné. */
  buildUrl: (format: ExportFormat, locale: ExportLocale) => string;
  /** Désactive le bouton avec un tooltip si fourni. */
  disabled?: boolean;
  disabledTooltip?: string;
  /** Variante compacte (sans le compte) pour la fiche patient. */
  compact?: boolean;
  /** Called before navigation. Return false to cancel the export. */
  onBeforeExport?: (format: ExportFormat, locale: ExportLocale) => boolean | void;
};

const FORMAT_LABEL_FR: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (.xlsx)",
  json: "JSON",
};

const FORMAT_LABEL_EN: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (.xlsx)",
  json: "JSON",
};

const FORMAT_HINT_FR: Record<ExportFormat, string> = {
  csv: "Universel — CRM, marketing automation",
  xlsx: "4 feuilles colorées — équipe marketing",
  json: "Arborescent — intégration API / Zapier",
};

const FORMAT_HINT_EN: Record<ExportFormat, string> = {
  csv: "Universal — CRM, marketing automation",
  xlsx: "4 styled sheets — marketing team",
  json: "Tree-shaped — API / Zapier integration",
};

export function ExportFormatMenu({
  exportableCount,
  buildUrl,
  disabled,
  disabledTooltip,
  compact,
  onBeforeExport,
}: Props) {
  const uiLocale = useLocale();
  const defaultLocale: ExportLocale = uiLocale === "en" ? "en" : "fr";
  const [open, setOpen] = useState(false);
  const [chosenLocale, setChosenLocale] = useState<ExportLocale>(defaultLocale);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const labels = uiLocale === "en" ? FORMAT_LABEL_EN : FORMAT_LABEL_FR;
  const hints = uiLocale === "en" ? FORMAT_HINT_EN : FORMAT_HINT_FR;

  const buttonText = compact
    ? uiLocale === "en"
      ? "Export"
      : "Exporter"
    : `${uiLocale === "en" ? "Export" : "Exporter"}${exportableCount > 0 ? ` (${exportableCount})` : ""}`;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? disabledTooltip : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download className="h-3.5 w-3.5" />
        {buttonText}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && !disabled && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-border bg-white shadow-lg">
          <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            {uiLocale === "en" ? "Format" : "Format"}
          </div>
          {(["csv", "xlsx", "json"] as ExportFormat[]).map((fmt) => (
            <a
              key={fmt}
              href={buildUrl(fmt, chosenLocale)}
              download
              onClick={(e) => {
                if (onBeforeExport && onBeforeExport(fmt, chosenLocale) === false) {
                  e.preventDefault();
                  return;
                }
                setOpen(false);
              }}
              className="block px-3 py-2 text-sm transition hover:bg-surface-muted"
            >
              <div className="font-medium">{labels[fmt]}</div>
              <div className="text-xs text-muted-foreground">{hints[fmt]}</div>
            </a>
          ))}

          <div className="border-t border-border px-3 py-2">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {uiLocale === "en" ? "Language" : "Langue"}
            </div>
            <div className="flex gap-2">
              {(["fr", "en"] as ExportLocale[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setChosenLocale(l)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs font-medium " +
                    (chosenLocale === l
                      ? "border-foreground bg-foreground text-white"
                      : "border-border bg-surface text-foreground hover:bg-surface-muted")
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
