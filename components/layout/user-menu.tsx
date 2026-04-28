"use client";

import { LogOut, UserCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/lib/auth-actions";

export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("userMenu");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink transition-colors hover:bg-surface-muted"
      >
        <UserCircle2 className="size-5 text-muted-foreground" aria-hidden />
        <span className="hidden font-medium sm:inline">{name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[180px] overflow-hidden rounded-md border border-border bg-surface shadow-md">
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("connectedAs")}
            </p>
            <p className="text-sm font-medium text-ink">{name}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-muted"
            >
              <LogOut className="size-4 text-muted-foreground" aria-hidden />
              {t("logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
