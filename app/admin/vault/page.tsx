import Link from "next/link";
import { Building2, Download, FileText, Network, Users, Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { listVaultPagesByKind } from "@/lib/vault/ingest";

const KIND_ICON: Record<string, typeof FileText> = {
  index: FileText,
  practitioner: Users,
  assistant: Users,
  center: Building2,
  patient: Users,
  pattern: Wrench,
  session: FileText,
};

const KIND_ORDER = [
  "index",
  "practitioner",
  "assistant",
  "center",
  "patient",
  "pattern",
  "session",
] as const;

type Kind = (typeof KIND_ORDER)[number];

export default async function AdminVaultPage() {
  const t = await getTranslations("vault");
  const byKind = await listVaultPagesByKind();
  const total = Array.from(byKind.values()).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/vault/graph">
              <Button variant="outline" size="sm">
                <Network className="size-4" aria-hidden />
                {t("graphView")}
              </Button>
            </Link>
            <a href="/api/admin/vault/export" download>
              <Button size="sm">
                <Download className="size-4" aria-hidden />
                {t("exportZip")}
              </Button>
            </a>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Stat label={t("statTotal")} value={total} />
        <Stat
          label={t("statPractitioners")}
          value={byKind.get("practitioner")?.length ?? 0}
        />
        <Stat
          label={t("statPatients")}
          value={byKind.get("patient")?.length ?? 0}
        />
        <Stat
          label={t("statSessions")}
          value={byKind.get("session")?.length ?? 0}
        />
      </div>

      <div className="flex flex-col gap-6">
        {KIND_ORDER.map((kind) => {
          const pages = byKind.get(kind) ?? [];
          if (pages.length === 0 && kind !== "session") return null;
          const Icon = KIND_ICON[kind] ?? FileText;
          const label = t(`byKind.${kind as Kind}`);
          const description = t(`byKindDescription.${kind as Kind}`);

          return (
            <section
              key={kind}
              className="rounded-lg border border-border bg-surface px-5 py-4"
            >
              <div className="mb-1 flex items-center gap-2">
                <Icon className="size-4 text-brand" aria-hidden />
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  ({pages.length})
                </span>
              </div>
              {description && (
                <p className="mb-3 text-xs text-muted-foreground">{description}</p>
              )}
              {pages.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noPagesYet")}</p>
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
