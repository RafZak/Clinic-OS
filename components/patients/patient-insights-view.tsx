"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARE_DIMENSIONS,
  CARE_LABEL_FR,
  CARE_LABEL_EN,
  CARE_SUB_FR,
  CARE_SUB_EN,
  CARE_CAPTURES_FR,
  CARE_CAPTURES_EN,
  CARE_USED_FR,
  CARE_USED_EN,
  type CareDimension,
} from "@/lib/care-insights/dimensions";
import {
  COMMUNICATION_KEYS,
  SETBACK_KEYS,
  PRIORITY_KEYS,
  communicationLabel,
  setbackLabel,
  priorityLabel,
} from "@/lib/relationship/taxonomy";
import type {
  CommunicationStyle,
  Setbacks,
  Priorities,
} from "@/lib/relationship/types";
import { cn } from "@/lib/utils";

type DimensionInput = { key: CareDimension; score: number | null };

export type PatientInsightsViewProps = {
  dimensions: DimensionInput[];
  communicationStyle: CommunicationStyle;
  setbacks: Setbacks;
  priorities: Priorities;
};

type TagState = "lead" | "on" | "off";

export function PatientInsightsView({
  dimensions,
  communicationStyle,
  setbacks,
  priorities,
}: PatientInsightsViewProps) {
  const t = useTranslations("careInsights");
  const locale = useLocale();
  const isEn = locale === "en";
  const lang: "fr" | "en" = isEn ? "en" : "fr";

  const labels = isEn ? CARE_LABEL_EN : CARE_LABEL_FR;
  const subs = isEn ? CARE_SUB_EN : CARE_SUB_FR;
  const captures = isEn ? CARE_CAPTURES_EN : CARE_CAPTURES_FR;
  const usedTo = isEn ? CARE_USED_EN : CARE_USED_FR;

  const byKey = new Map(dimensions.map((d) => [d.key, d.score]));
  const firstObserved =
    dimensions.find((d) => d.score !== null)?.key ?? CARE_DIMENSIONS[0];
  const [selected, setSelected] = useState<CareDimension>(firstObserved);

  const selScore = byKey.get(selected) ?? null;

  const commState = (k: (typeof COMMUNICATION_KEYS)[number]): TagState =>
    communicationStyle.lead === k
      ? "lead"
      : communicationStyle.relevant.includes(k)
        ? "on"
        : "off";
  const setbackState = (k: (typeof SETBACK_KEYS)[number]): TagState =>
    setbacks.present.includes(k) ? "on" : "off";
  const prioState = (k: (typeof PRIORITY_KEYS)[number]): TagState =>
    priorities.lead === k
      ? "lead"
      : priorities.relevant.includes(k)
        ? "on"
        : "off";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Colonne gauche : dimensions en barres */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          {t("heading")}
        </p>
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          {t("subheading")}
        </h3>
        <ul className="flex flex-col gap-3">
          {CARE_DIMENSIONS.map((key) => {
            const score = byKey.get(key) ?? null;
            const pct = score === null ? 0 : score * 10;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setSelected(key)}
                  className={cn(
                    "w-full rounded-md p-2 text-left transition",
                    selected === key ? "bg-brand/5" : "hover:bg-light"
                  )}
                  aria-pressed={selected === key}
                >
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "text-[13px] font-medium",
                        selected === key
                          ? "text-brand-dark"
                          : "text-foreground"
                      )}
                    >
                      {labels[key]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {score === null ? t("notObserved") : `${pct}%`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Colonne droite : panneau détail dimension sélectionnée */}
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
            {t("subheading")}
          </p>
          <span className="ml-auto text-xs text-muted-foreground">
            {selScore === null ? t("notObserved") : `${selScore * 10}%`}
          </span>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-foreground">
          {labels[selected]}
        </h3>
        <p className="mb-4 text-[13px] text-muted-foreground">
          {subs[selected]}
        </p>
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${selScore === null ? 0 : selScore * 10}%` }}
          />
        </div>
        <div className="mb-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand">
            {t("captures")}
          </p>
          <p className="text-[13px] leading-relaxed text-foreground">
            {captures[selected]}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            {t("usedTo")}
          </p>
          <p className="text-[13px] leading-relaxed text-foreground">
            {usedTo[selected]}
          </p>
        </div>
      </section>

      {/* Communication style */}
      <TagBlock
        heading={t("commHeading")}
        sub={t("commSub")}
        tags={COMMUNICATION_KEYS.map((k) => ({
          label: communicationLabel(k, lang),
          state: commState(k),
        }))}
      />

      {/* Setbacks */}
      <TagBlock
        heading={t("setbacksHeading")}
        sub={t("setbacksSub")}
        tags={SETBACK_KEYS.map((k) => ({
          label: setbackLabel(k, lang),
          state: setbackState(k),
        }))}
      />

      {/* Priorities — pleine largeur */}
      <div className="lg:col-span-2">
        <TagBlock
          heading={t("prioritiesHeading")}
          sub={t("prioritiesSub")}
          tags={PRIORITY_KEYS.map((k) => ({
            label: priorityLabel(k, lang),
            state: prioState(k),
          }))}
          legend={{
            top: t("legendTop"),
            relevant: t("legendRelevant"),
            off: t("legendOff"),
          }}
        />
      </div>
    </div>
  );
}

function TagBlock({
  heading,
  sub,
  tags,
  legend,
}: {
  heading: string;
  sub: string;
  tags: Array<{ label: string; state: TagState }>;
  legend?: { top: string; relevant: string; off: string };
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
        {heading}
      </p>
      <p className="mb-3 text-[11px] text-muted-foreground">{sub}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
              tag.state === "lead" && "bg-brand text-white",
              tag.state === "on" && "border border-brand/40 bg-brand/10 text-brand",
              tag.state === "off" && "bg-light text-muted-foreground"
            )}
          >
            {tag.label}
          </span>
        ))}
      </div>
      {legend ? (
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-full bg-brand" />
            {legend.top}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-full border border-brand/40 bg-brand/10" />
            {legend.relevant}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-full bg-light" />
            {legend.off}
          </span>
        </div>
      ) : null}
    </section>
  );
}
