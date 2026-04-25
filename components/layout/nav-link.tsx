"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type NavLinkProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: "exact" | "prefix";
  badge?: { count: number; tone: "alert" | "info"; tooltip: string } | null;
};

export function NavLink({
  href,
  label,
  icon,
  match = "prefix",
  badge,
}: NavLinkProps) {
  const pathname = usePathname();
  const active =
    match === "exact"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-surface-muted text-ink [&_svg]:text-brand"
          : "text-muted-foreground hover:bg-surface-muted hover:text-ink [&_svg]:text-muted-foreground hover:[&_svg]:text-ink"
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && badge.count > 0 && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label={badge.tooltip}
                className={cn(
                  "inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                  badge.tone === "alert"
                    ? "bg-red-100 text-red-700"
                    : "bg-brand/10 text-brand"
                )}
              >
                {badge.count}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">{badge.tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </Link>
  );
}
