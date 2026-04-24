import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/db/client";
import { vaultPages } from "@/db/schema";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { VaultMarkdown } from "@/components/admin/vault-markdown";
import { Button } from "@/components/ui/button";
import {
  getVaultPageByPath,
  getInboundBacklinks,
} from "@/lib/vault/ingest";

export default async function VaultPagePage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/") + (pathSegments.join("/").endsWith(".md") ? "" : ".md");

  const [page, inbound, allPages] = await Promise.all([
    getVaultPageByPath(path),
    getInboundBacklinks(path),
    db
      .select({ path: vaultPages.path, title: vaultPages.title })
      .from(vaultPages)
      .orderBy(asc(vaultPages.path)),
  ]);

  if (!page) {
    notFound();
  }

  const pageIndex = allPages.map((p) => ({
    slug: p.path.replace(/^.*\//, "").replace(/\.md$/, ""),
    path: p.path,
  }));

  // Outbound : déjà stockés dans page.backlinks (slugs)
  const outboundResolved = page.backlinks.map((slug) => {
    const match = pageIndex.find((p) => p.slug === slug);
    return { slug, path: match?.path ?? null, title: match?.path?.replace(/\.md$/, "") ?? slug };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={page.title}
        description={`${page.path} · ${page.kind} · mis à jour ${
          page.updatedAt ? page.updatedAt.toISOString().slice(0, 16).replace("T", " ") : "—"
        }`}
        actions={
          <Link href="/admin/vault">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" aria-hidden />
              Retour à la liste
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-lg border border-border bg-surface px-6 py-5 lg:col-span-8">
          <VaultMarkdown raw={page.contentMd} pageIndex={pageIndex} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <BacklinkPanel
            title="Liens sortants"
            description="Cette fiche pointe vers"
            entries={outboundResolved.map((b) => ({
              label: b.title,
              path: b.path,
              slug: b.slug,
            }))}
          />
          <BacklinkPanel
            title="Liens entrants"
            description="Pages qui pointent vers cette fiche"
            entries={inbound.map((b) => ({ label: b.title, path: b.path, slug: null }))}
          />
        </div>
      </div>
    </div>
  );
}

function BacklinkPanel({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: { label: string; path: string | null; slug: string | null }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4">
      <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs italic text-muted-foreground">— Aucun</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {entries.map((e, i) => (
            <li key={`${e.path}-${i}`}>
              {e.path ? (
                <Link
                  href={`/admin/vault/${e.path.replace(/\.md$/, "")}`}
                  className="flex items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs text-brand transition hover:bg-brand/5"
                >
                  <ExternalLink className="size-3" aria-hidden />
                  <span className="truncate">{e.label}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs text-muted-foreground">
                  [[{e.slug ?? e.label}]] (cible non créée)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
