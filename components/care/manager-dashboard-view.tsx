"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  CARE_AXES,
  type CareAxis,
  type CareRadar,
  type CareTier,
} from "@/lib/care-quality/types";
import { CARE_LABEL_FR, CARE_LABEL_EN } from "@/lib/care-quality/axes";
import { CareRadar as CareRadarChart } from "./care-radar";

const BRAND = "#CC0641";
const TIER_COLOR: Record<CareTier, string> = {
  signature: "#CC0641",
  solid: "#E8849F",
  developing: "#F3D3DC",
};
const TIER_ORDER: CareTier[] = ["signature", "solid", "developing"];

export function ManagerDashboardView({
  teamRadar,
  distribution,
  clinicianCount,
}: {
  teamRadar: CareRadar;
  distribution: Record<CareAxis, Record<CareTier, number>>;
  clinicianCount: number;
}) {
  const t = useTranslations("managerDashboard");
  const locale = useLocale();
  const labels = locale === "en" ? CARE_LABEL_EN : CARE_LABEL_FR;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("teamMeta", { count: clinicianCount })}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="flex justify-center rounded-lg border border-border bg-surface p-5">
          <CareRadarChart
            layers={[
              {
                key: "team",
                radar: teamRadar,
                color: BRAND,
                fillOpacity: 0.28,
                strokeWidth: 2.5,
              },
            ]}
            size={340}
          />
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="text-[13px] font-semibold text-foreground">
            {t("distributionTitle")}
          </p>
          <p className="mb-4 text-[11px] text-muted-foreground">
            {t("distributionSub")}
          </p>
          <div className="flex flex-col gap-2.5">
            {CARE_AXES.map((axis) => {
              const d = distribution[axis];
              const total = d.signature + d.solid + d.developing;
              return (
                <div
                  key={axis}
                  className="grid grid-cols-[120px_1fr] items-center gap-3"
                >
                  <span className="text-[12px] text-muted-foreground">
                    {labels[axis]}
                  </span>
                  <div className="flex h-3 overflow-hidden rounded-full bg-light">
                    {total > 0 &&
                      TIER_ORDER.map((tier) =>
                        d[tier] > 0 ? (
                          <span
                            key={tier}
                            style={{
                              width: `${(d[tier] / total) * 100}%`,
                              background: TIER_COLOR[tier],
                            }}
                          />
                        ) : null
                      )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {TIER_ORDER.map((tier) => (
              <span key={tier} className="inline-flex items-center gap-1.5">
                <i
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: TIER_COLOR[tier] }}
                />
                {t(`tier_${tier}`)}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[12px] font-semibold text-emerald-800">
            {t("alwaysAggregatedTitle")}
          </p>
          <p className="mt-1 text-[12px] text-emerald-700">
            {t("alwaysAggregatedBody")}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[12px] font-semibold text-red-800">
            {t("neverVisibleTitle")}
          </p>
          <p className="mt-1 text-[12px] text-red-700">
            {t("neverVisibleBody")}
          </p>
        </div>
      </div>
    </div>
  );
}
