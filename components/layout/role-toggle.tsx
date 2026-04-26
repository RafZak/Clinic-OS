"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setRole } from "@/app/actions/set-role";
import type { Role } from "@/lib/role";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["audioprothesiste", "assistant"];

export function RoleToggle({ current }: { current: Role }) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("roles");

  return (
    <div
      role="tablist"
      aria-label={t("ariaToggle")}
      className="inline-flex items-center rounded-full border border-border bg-surface-muted p-0.5 text-xs font-medium"
    >
      {ROLES.map((value) => {
        const active = value === current;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={isPending}
            onClick={() => startTransition(() => setRole(value))}
            className={cn(
              "rounded-full px-3 py-1 transition-colors disabled:opacity-60",
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-muted-foreground hover:text-ink"
            )}
          >
            {t(value)}
          </button>
        );
      })}
    </div>
  );
}
