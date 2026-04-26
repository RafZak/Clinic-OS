"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setLocale } from "@/app/actions/set-locale";
import type { Locale } from "@/lib/locale";
import { cn } from "@/lib/utils";

const LOCALES: Locale[] = ["fr", "en"];

export function LocaleSwitch({ current }: { current: Locale }) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("locale");

  return (
    <div
      role="tablist"
      aria-label={t("ariaToggle")}
      className="inline-flex items-center rounded-full border border-border bg-surface-muted p-0.5 text-[11px] font-semibold tracking-wide"
    >
      {LOCALES.map((value) => {
        const active = value === current;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={isPending}
            onClick={() => startTransition(() => setLocale(value))}
            className={cn(
              "rounded-full px-2.5 py-1 uppercase transition-colors disabled:opacity-60",
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-muted-foreground hover:text-ink"
            )}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
