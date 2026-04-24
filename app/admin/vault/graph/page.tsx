import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { vaultPages } from "@/db/schema";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { VaultGraph } from "@/components/admin/vault-graph";

export default async function VaultGraphPage() {
  const rows = await db
    .select({
      path: vaultPages.path,
      kind: vaultPages.kind,
      title: vaultPages.title,
      backlinks: vaultPages.backlinks,
    })
    .from(vaultPages)
    .orderBy(asc(vaultPages.kind));

  const nodes = rows.map((r) => ({
    id: r.path,
    slug: r.path.replace(/^.*\//, "").replace(/\.md$/, ""),
    title: r.title,
    kind: r.kind,
  }));

  const slugToPath = new Map(nodes.map((n) => [n.slug, n.id]));
  const edges: { source: string; target: string }[] = [];
  for (const r of rows) {
    const slugs = Array.isArray(r.backlinks) ? (r.backlinks as string[]) : [];
    for (const slug of slugs) {
      const target = slugToPath.get(slug);
      if (target && target !== r.path) {
        edges.push({ source: r.path, target });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vault — Vue graph"
        description="Visualisation des relations entre fiches via les wikilinks. Cliquez sur un nœud pour ouvrir la fiche."
        actions={
          <Link href="/admin/vault">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" aria-hidden />
              Retour à la liste
            </Button>
          </Link>
        }
      />
      <div className="rounded-lg border border-border bg-surface" style={{ height: "640px" }}>
        <VaultGraph nodes={nodes} edges={edges} />
      </div>
      <p className="text-xs text-muted-foreground">
        {nodes.length} fiches · {edges.length} liens. Layout calculé automatiquement à partir
        des wikilinks détectés en base.
      </p>
    </div>
  );
}
