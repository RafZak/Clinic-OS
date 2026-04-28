import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Home } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, sessions, vaultPages, programs } from "@/db/schema";

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function humanize(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type Crumb = { href: string; label: string; clickable: boolean; isHome?: boolean };

async function resolveSingleSegmentLabel(
  parentPath: string,
  segment: string
): Promise<string | null> {
  if (parentPath === "/patients" && UUID_RE.test(segment)) {
    const [row] = await db
      .select({ label: patients.label })
      .from(patients)
      .where(eq(patients.id, segment))
      .limit(1);
    return row?.label ?? null;
  }

  if (
    (parentPath === "/consultations" || parentPath === "/appels") &&
    UUID_RE.test(segment)
  ) {
    const [row] = await db
      .select({ label: patients.label })
      .from(sessions)
      .leftJoin(patients, eq(sessions.patientId, patients.id))
      .where(eq(sessions.id, segment))
      .limit(1);
    return row?.label ?? null;
  }

  if (parentPath === "/catalogue") {
    const [row] = await db
      .select({ title: programs.title })
      .from(programs)
      .where(eq(programs.slug, segment))
      .limit(1);
    return row?.title ?? null;
  }

  return null;
}

async function buildVaultPageCrumbs(
  vaultSegments: string[],
  pathname: string
): Promise<Crumb[]> {
  const fullPath = vaultSegments.join("/") + ".md";
  const [row] = await db
    .select({ title: vaultPages.title })
    .from(vaultPages)
    .where(eq(vaultPages.path, fullPath))
    .limit(1);

  const crumbs: Crumb[] = [];
  // Segments intermédiaires = dossiers de catégorie (patients, practitioners…)
  for (let j = 0; j < vaultSegments.length - 1; j++) {
    crumbs.push({
      href: "",
      label: humanize(vaultSegments[j]),
      clickable: false,
    });
  }
  const last = vaultSegments[vaultSegments.length - 1];
  crumbs.push({
    href: pathname,
    label: row?.title ?? humanize(last),
    clickable: false,
  });
  return crumbs;
}

export async function Breadcrumbs() {
  let crumbs: Crumb[] = [];
  let breadcrumbAria = "Breadcrumb";
  try {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") ?? "/";
    const tNav = await getTranslations("nav");
    breadcrumbAria = tNav("breadcrumbAria");

    if (pathname === "/" || pathname === "") return null;

    const segments = pathname.split("/").filter(Boolean);
    crumbs = [
      { href: "/", label: tNav("dashboard"), clickable: true, isHome: true },
    ];

    let acc = "";
    let i = 0;
    while (i < segments.length) {
      const seg = segments[i];
      acc += `/${seg}`;

      // Sous-pages du vault : tous les segments restants forment le path
      // d'une fiche unique, on les traite ensemble.
      if (acc.startsWith("/admin/vault/") && acc !== "/admin/vault/graph") {
        const vaultCrumbs = await buildVaultPageCrumbs(
          segments.slice(i),
          pathname
        );
        crumbs.push(...vaultCrumbs);
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
        continue;
      }

      const parentPath =
        `/${segments.slice(0, i).join("/")}`.replace(/\/+$/, "") || "/";
      const dynamicLabel = await resolveSingleSegmentLabel(parentPath, seg);

      crumbs.push({
        href: acc,
        label: dynamicLabel ?? humanize(seg),
        clickable: NAVIGABLE_ROUTES.has(acc),
      });
      i++;
    }
  } catch (err) {
    console.error("[Breadcrumbs] failed:", err);
    return null;
  }

  if (crumbs.length < 2) return null;

  return (
    <nav
      aria-label={breadcrumbAria}
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
