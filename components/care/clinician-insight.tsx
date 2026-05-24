"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { CARE_AXES, type CareAxis, type CareSnapshot } from "@/lib/care-quality/types";
import {
  CARE_LABEL_FR,
  CARE_LABEL_EN,
  CARE_SUB_FR,
  CARE_SUB_EN,
  CARE_CAPTURES_FR,
  CARE_CAPTURES_EN,
  CARE_USED_FR,
  CARE_USED_EN,
  CARE_NOT_FR,
  CARE_NOT_EN,
} from "@/lib/care-quality/axes";
import { CareRadar } from "./care-radar";
import { cn } from "@/lib/utils";

const BRAND = "#CC0641";

export function ClinicianInsight({
  radar,
  rationale,
  sessionsCount,
}: {
  radar: CareSnapshot["radar"];
  rationale: CareSnapshot["rationale"];
  sessionsCount: number;
}) {
  const t = useTranslations("clinicianInsight");
  const locale = useLocale();
  const isEn = locale === "en";

  const labels = isEn ? CARE_LABEL_EN : CARE_LABEL_FR;
  const subs = isEn ? CARE_SUB_EN : CARE_SUB_FR;
  const captures = isEn ? CARE_CAPTURES_EN : CARE_CAPTURES_FR;
  const usedTo = isEn ? CARE_USED_EN : CARE_USED_FR;
  const notThis = isEn ? CARE_NOT_EN : CARE_NOT_FR;

  const firstObserved =
    CARE_AXES.find((a) => radar[a] !== null) ?? CARE_AXES[0];
  const [selected, setSelected] = useState<CareAxis>(firstObserved);
  const selScore = radar[selected];
  const selRationale = rationale?.[selected];

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <header className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          {t("eyebrow")}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("synthesizedAcross", { count: sessionsCount })}
        </p>
      </header>

      <div className="mb-4 inline-flex items-start gap-2 rounded-md border border-brand/20 bg-brand/[0.04] px-3 py-2 text-[12px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span>{t("privacy")}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col items-center gap-3">
          <CareRadar
            layers={[
              {
                key: "me",
                radar,
                color: BRAND,
                fillOpacity: 0.28,
                strokeWidth: 2.5,
              },
            ]}
            size={320}
          />
          <ul className="grid w-full grid-cols-2 gap-1.5">
            {CARE_AXES.map((axis) => {
              const score = radar[axis];
              return (
                <li key={axis}>
                  <button
                    type="button"
                    onClick={() => setSelected(axis)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition",
                      selected === axis ? "bg-brand/5" : "hover:bg-light"
                    )}
                    aria-pressed={selected === axis}
                  >
                    <span
                      className={cn(
                        "font-medium",
                        selected === axis ? "text-brand-dark" : "text-foreground"
                      )}
                    >
                      {labels[axis]}
                    </span>
                    <span className="text-muted-foreground">
                      {score === null ? "—" : `${score}%`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-md border border-border bg-light/40 p-4">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
              {t("careDimension")}
            </p>
            <span className="ml-auto text-xs text-muted-foreground">
              {selScore === null ? t("notObserved") : `${selScore}%`}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-foreground">
            {labels[selected]}
          </h3>
          <p className="mb-3 text-[13px] text-muted-foreground">
            {subs[selected]}
          </p>

          {selRationale ? (
            <p className="mb-3 rounded bg-white px-3 py-2 text-[13px] italic text-foreground">
              {isEn ? selRationale.en : selRationale.fr}
            </p>
          ) : null}

          <DetailRow label={t("captures")} value={captures[selected]} tone="brand" />
          <DetailRow label={t("usedTo")} value={usedTo[selected]} tone="amber" />
          <DetailRow label={t("notThis")} value={notThis[selected]} tone="muted" />
        </div>
      </div>

      <p className="mt-4 border-t border-border/70 pt-3 text-[12px] text-muted-foreground">
        {t("valueChain")}
      </p>
    </section>
  );
}

function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "amber" | "muted";
}) {
  const labelColor =
    tone === "brand"
      ? "text-brand"
      : tone === "amber"
        ? "text-amber-700"
        : "text-muted-foreground";
  return (
    <div className="mb-2.5 last:mb-0">
      <p className={cn("mb-0.5 text-[10px] font-semibold uppercase tracking-wide", labelColor)}>
        {label}
      </p>
      <p className="text-[13px] leading-relaxed text-foreground">{value}</p>
    </div>
  );
}
