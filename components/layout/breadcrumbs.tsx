"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABEL: Record<string, string> = {
  patients: "nav.patients",
  catalogue: "nav.catalogue",
  consultations: "nav.consultations",
  appels: "nav.calls",
  admin: "nav.admin",
  knowledge: "nav.knowledge",
  vault: "nav.memory",
  graph: "nav.graph",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function humanize(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations();

  if (pathname === "/" || pathname === "") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string; isHome?: boolean }[] = [
    { href: "/", label: t("nav.dashboard"), isHome: true },
  ];

  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    if (UUID_RE.test(seg)) continue;
    const key = SEGMENT_LABEL[seg];
    crumbs.push({ href: acc, label: key ? t(key) : humanize(seg) });
  }

  if (crumbs.length < 2) return null;

  return (
    <nav
      aria-label={t("nav.breadcrumbAria")}
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const content = c.isHome ? (
          <span className="flex items-center gap-1">
            <Home className="h-3 w-3" aria-hidden />
            <span className="sr-only">{c.label}</span>
          </span>
        ) : (
          <span>{c.label}</span>
        );
        return (
          <span key={c.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {isLast ? (
              <span className="font-medium text-ink">{content}</span>
            ) : (
              <Link
                href={c.href}
                className="transition-colors hover:text-ink"
              >
                {content}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
