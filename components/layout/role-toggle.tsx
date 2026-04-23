"use client";

import { useTransition } from "react";
import { setRole } from "@/app/actions/set-role";
import type { Role } from "@/lib/role";
import { cn } from "@/lib/utils";

const ROLES: { value: Role; label: string }[] = [
  { value: "audioprothesiste", label: "Audioprothésiste" },
  { value: "assistant", label: "Assistant accueil" },
];

export function RoleToggle({ current }: { current: Role }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="tablist"
      aria-label="Changer de rôle"
      className="inline-flex items-center rounded-full border border-border bg-surface-muted p-0.5 text-xs font-medium"
    >
      {ROLES.map(({ value, label }) => {
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
            {label}
          </button>
        );
      })}
    </div>
  );
}
