"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavLinkProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: "exact" | "prefix";
};

export function NavLink({ href, label, icon, match = "prefix" }: NavLinkProps) {
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
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
