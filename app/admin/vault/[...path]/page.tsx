import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { vaultPages } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { VaultMarkdown } from "@/components/admin/vault-markdown";
import { Button } from "@/components/ui/button";
import { getVaultPageByPath } from "@/lib/vault/ingest";
import { parseFrontmatter } from "@/lib/vault/frontmatter";
import {
  loadRecentSessionsForVaultPage,
  type VaultRecentSession,
} from "@/lib/vault/recent-sessions";

type Kind = "index" | "practitioner" | "assistant" | "center" | "patient" | "pattern" | "session";

export default async function VaultPagePage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/") + (pathSegments.join("/").endsWith(".md") ? "" : ".md");

  const [page, allPages] = await Promise.all([
    getVaultPageByPath(path),
    db
      .select({ path: vaultPages.path, title: vaultPages.title })
      .from(vaultPages)
      .orderBy(asc(vaultPages.path)),
  ]);

  if (!page) {
    notFound();
  }

  const t = await getTranslations("vault");
  const locale = await getLocale();

  const pageIndex = allPages.map((p) => ({
    slug: p.path.replace(/^.*\//, "").replace(/\.md$/, ""),
    path: p.path,
    title: p.title,
  }));

  const { metadata } = parseFrontmatter(page.contentMd);
  const recentSessions = await loadRecentSessionsForVaultPage(metadata);
  const enrichedContentMd = injectRecentSessions(
    page.contentMd,
    recentSessions,
    locale
  );

  const kindLabel = t(`kindLabel.${page.kind as Kind}`);
  const updatedAt = page.updatedAt
    ? page.updatedAt.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={page.title}
        description={`${kindLabel} · ${t("updatedAtSuffix", { date: updatedAt })}`}
        actions={
          <Link href="/admin/vault">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" aria-hidden />
              {t("backToList")}
            </Button>
          </Link>
        }
      />

      <div className="rounded-lg border border-border bg-surface px-6 py-5">
        <VaultMarkdown
          raw={enrichedContentMd}
          pageIndex={pageIndex}
          pageTitle={page.title}
        />
      </div>
    </div>
  );
}

const RECENT_SESSIONS_PLACEHOLDERS = [
  "_Aucune session analysée pour l'instant._",
  "_No analyzed session yet._",
  "_Sera enrichie automatiquement à chaque session ou événement enregistré._",
  "_Will be enriched automatically with each recorded session or event._",
];

function injectRecentSessions(
  contentMd: string,
  rows: VaultRecentSession[],
  locale: string
): string {
  if (rows.length === 0) return contentMd;
  const block = renderSessionsBlock(rows, locale);
  let out = contentMd;
  for (const placeholder of RECENT_SESSIONS_PLACEHOLDERS) {
    if (out.includes(placeholder)) {
      out = out.replace(placeholder, block);
    }
  }
  return out;
}

function renderSessionsBlock(
  rows: VaultRecentSession[],
  locale: string
): string {
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";
  return rows
    .map((r) => {
      const dateLabel = r.startedAt
        ? r.startedAt.toLocaleDateString(dateLocale, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—";
      const baseHref = r.kind === "phone_call" ? "/appels" : "/consultations";
      const score =
        r.globalScore != null ? `${r.globalScore}/100` : locale === "en" ? "n/a" : "n/d";
      const who = r.patientLabel ?? r.practitionerName ?? "—";
      return `- **${dateLabel}** — [${who}](${baseHref}/${r.id}) · ${score}`;
    })
    .join("\n");
}
