import Link from "next/link";
import { Building2, Download, FileText, Network, Users, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { listVaultPagesByKind } from "@/lib/vault/ingest";

const KIND_META: Record<
  string,
  { label: string; icon: typeof FileText; description: string }
> = {
  index: {
    label: "Sommaire",
    icon: FileText,
    description: "Page d'accueil de la mémoire organisationnelle.",
  },
  practitioner: {
    label: "Audioprothésistes",
    icon: Users,
    description:
      "Une fiche par audioprothésiste — forces, axes d'amélioration, sessions récentes.",
  },
  assistant: {
    label: "Assistants accueil",
    icon: Users,
    description:
      "Une fiche par assistant accueil — qualité des appels, patterns identifiés.",
  },
  center: {
    label: "Centres",
    icon: Building2,
    description: "Une fiche par centre du réseau.",
  },
  patient: {
    label: "Patients",
    icon: Users,
    description:
      "Profil clinique, parcours et entourage de chaque patient suivi.",
  },
  pattern: {
    label: "Patterns récurrents",
    icon: Wrench,
    description:
      "Situations métier récurrentes identifiées à travers le réseau (objection prix, montée en gamme, etc.).",
  },
  session: {
    label: "Fiches session",
    icon: FileText,
    description: "Une fiche générée automatiquement après chaque session analysée.",
  },
};

const KIND_ORDER = [
  "index",
  "practitioner",
  "assistant",
  "center",
  "patient",
  "pattern",
  "session",
];

export default async function AdminVaultPage() {
  const byKind = await listVaultPagesByKind();
  const total = Array.from(byKind.values()).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mémoire organisationnelle"
        description="Une fiche vivante par audioprothésiste, assistant accueil, patient et centre. Chaque consultation ou appel analysé enrichit automatiquement les fiches concernées — exportable en Obsidian, auditable à tout moment."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/vault/graph">
              <Button variant="outline" size="sm">
                <Network className="size-4" aria-hidden />
                Vue graph
              </Button>
            </Link>
            <a href="/api/admin/vault/export" download>
              <Button size="sm">
                <Download className="size-4" aria-hidden />
                Export Obsidian (.zip)
              </Button>
            </a>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Stat label="Fiches dans la mémoire" value={total} />
        <Stat
          label="Audioprothésistes suivis"
          value={byKind.get("practitioner")?.length ?? 0}
        />
        <Stat
          label="Patients suivis"
          value={byKind.get("patient")?.length ?? 0}
        />
        <Stat
          label="Sessions analysées"
          value={byKind.get("session")?.length ?? 0}
        />
      </div>

      <div className="flex flex-col gap-6">
        {KIND_ORDER.map((kind) => {
          const pages = byKind.get(kind) ?? [];
          if (pages.length === 0 && kind !== "session") return null;
          const meta = KIND_META[kind] ?? { label: kind, icon: FileText, description: "" };
          const Icon = meta.icon;

          return (
            <section
              key={kind}
              className="rounded-lg border border-border bg-surface px-5 py-4"
            >
              <div className="mb-1 flex items-center gap-2">
                <Icon className="size-4 text-brand" aria-hidden />
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {meta.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  ({pages.length})
                </span>
              </div>
              {meta.description && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {meta.description}
                </p>
              )}
              {pages.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune fiche pour l&apos;instant. Les fiches session sont créées automatiquement
                  après chaque analyse.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border/60">
                  {pages.map((p) => (
                    <li key={p.path} className="py-2">
                      <Link
                        href={`/admin/vault/${p.path.replace(/\.md$/, "")}`}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-surface-muted"
                      >
                        <span className="truncate font-medium text-ink">{p.title}</span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {p.path}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
