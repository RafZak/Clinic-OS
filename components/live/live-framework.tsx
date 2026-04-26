"use client";

import { Circle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import {
  getScorableFramework,
  getStepName,
  getStepDescription,
  type FrameworkKind,
} from "@/lib/frameworks";
import type { Locale } from "@/lib/locale";

export function LiveFramework({ kind }: { kind: FrameworkKind }) {
  const t = useTranslations("liveFramework");
  const tFw = useTranslations("framework");
  const locale = useLocale() as Locale;
  const steps = getScorableFramework(kind);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{t("header", { label: tFw(kind) })}</span>
        <span>{t("stepsCount", { count: steps.length })}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ol className="space-y-2">
          {steps.map((s) => (
            <li
              key={s.number}
              className="flex items-start gap-3 rounded-md border border-border-subtle bg-light/40 px-3 py-2"
            >
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold tabular-nums text-muted-foreground">
                {s.number}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {getStepName(s, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <Circle className="size-2.5" aria-hidden />
                    {t("toEval")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getStepDescription(s, locale)}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          {t("footer")}
        </p>
      </div>
    </div>
  );
}
