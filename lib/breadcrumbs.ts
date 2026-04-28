import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, sessions, vaultPages, programs } from "@/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResolvedCrumb = {
  segment: string;
  label: string | null;
  scope: "vault-page" | "single";
};

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

async function resolveVaultPageLabel(
  vaultSegments: string[]
): Promise<string | null> {
  const fullPath = vaultSegments.join("/") + ".md";
  const [row] = await db
    .select({ title: vaultPages.title })
    .from(vaultPages)
    .where(eq(vaultPages.path, fullPath))
    .limit(1);
  return row?.title ?? null;
}

/**
 * Pour un pathname donné, renvoie les libellés résolus (noms métier) pour
 * chaque segment dynamique (UUIDs, slugs, paths vault). Les segments statiques
 * (admin, patients, …) sont laissés au composant côté client qui utilise i18n.
 */
export async function resolveDynamicCrumbs(
  pathname: string
): Promise<ResolvedCrumb[]> {
  const segments = pathname.split("/").filter(Boolean);
  const results: ResolvedCrumb[] = [];

  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    const accSoFar = "/" + segments.slice(0, i + 1).join("/");

    if (accSoFar.startsWith("/admin/vault/") && accSoFar !== "/admin/vault/graph") {
      const remaining = segments.slice(i);
      const label = await resolveVaultPageLabel(remaining);
      results.push({
        segment: remaining.join("/"),
        label,
        scope: "vault-page",
      });
      break;
    }

    const parentPath =
      "/" + segments.slice(0, i).join("/").replace(/\/+$/, "");
    const label = await resolveSingleSegmentLabel(
      parentPath === "/" ? "/" : parentPath,
      seg
    );
    results.push({ segment: seg, label, scope: "single" });
    i++;
  }

  return results;
}
