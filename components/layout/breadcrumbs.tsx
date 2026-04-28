"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";

const NAVIGABLE_ROUTES = new Set<string>([
  "/",
  "/patients",
  "/consultations",
  "/appels",
  "/catalogue",
  "/admin/knowledge",
  "/admin/vault",
  "/admin/vault/graph",
]);

const STATIC_LABEL_NAV: Record<string, string> = {
  patients: "patients",
  catalogue: "catalogue",
  consultations: "consultations",
  appels: "calls",
  admin: "admin",
  knowledge: "knowledge",
  vault: "memory",
  graph: "graph",
};

function humanize(segment: string) {
  try {
    return decodeURIComponent(segment)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return segment;
  }
}

type Crumb = { href: string; label: string; clickable: boolean; isHome?: boolean };

type ResolvedCrumb = {
  segment: string;
  label: string | null;
  scope: "vault-page" | "single";
};

function buildCrumbs(
  pathname: string,
  resolved: ResolvedCrumb[],
  tNav: (key: string) => string
): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [
    { href: "/", label: tNav("dashboard"), clickable: true, isHome: true },
  ];

  let acc = "";
  let i = 0;
  // Index dans le tableau resolved : on consomme dans l'ordre où resolveDynamicCrumbs les produit
  let resolvedIdx = 0;

  while (i < segments.length) {
    const seg = segments[i];
    acc += `/${seg}`;

    if (acc.startsWith("/admin/vault/") && acc !== "/admin/vault/graph") {
      const remaining = segments.slice(i);
      // Le serveur résout le path complet en une seule entrée
      const r = resolved[resolvedIdx];
      const lastLabel =
        r?.scope === "vault-page" && r.label
          ? r.label
          : humanize(remaining[remaining.length - 1]);

      // Segments intermédiaires = catégories non cliquables
      for (let j = 0; j < remaining.length - 1; j++) {
        crumbs.push({
          href: "",
          label: humanize(remaining[j]),
          clickable: false,
        });
      }
      crumbs.push({
        href: pathname,
        label: lastLabel,
        clickable: false,
      });
      break;
    }

    const navKey = STATIC_LABEL_NAV[seg];
    if (navKey) {
      crumbs.push({
        href: acc,
        label: tNav(navKey),
        clickable: NAVIGABLE_ROUTES.has(acc),
      });
      i++;
      resolvedIdx++;
      continue;
    }

    const r = resolved[resolvedIdx];
    const dynamicLabel = r?.scope === "single" ? r.label : null;
    crumbs.push({
      href: acc,
      label: dynamicLabel ?? humanize(seg),
      clickable: NAVIGABLE_ROUTES.has(acc),
    });
    i++;
    resolvedIdx++;
  }

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const tNav = useTranslations("nav");
  const [resolved, setResolved] = useState<ResolvedCrumb[]>([]);

  useEffect(() => {
    if (pathname === "/" || pathname === "") {
      setResolved([]);
      return;
    }
    let cancelled = false;
    // Reset immédiat → affichage humanizé pendant la résolution
    setResolved([]);
    fetch(`/api/breadcrumb?path=${encodeURIComponent(pathname)}`)
      .then((r) => (r.ok ? r.json() : { crumbs: [] }))
      .then((data) => {
        if (!cancelled) setResolved(data.crumbs ?? []);
      })
      .catch(() => {
        // On garde la version humanizée ; pas besoin d'alerter.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname === "/" || pathname === "") return null;

  const crumbs = buildCrumbs(pathname, resolved, tNav);
  if (crumbs.length < 2) return null;

  return (
    <nav
      aria-label={tNav("breadcrumbAria")}
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
          <span key={`${c.href}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {isLast || !c.clickable ? (
              <span
                className={
                  isLast ? "font-medium text-ink" : "text-muted-foreground"
                }
              >
                {content}
              </span>
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
