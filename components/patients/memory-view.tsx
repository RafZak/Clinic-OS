"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VaultMarkdown } from "@/components/admin/vault-markdown";
import { parseMemoryMarkdown } from "@/lib/vault/parse-sections";
import { humanizeSlug } from "@/lib/vault/label";
import { cn } from "@/lib/utils";

type PageIndexEntry = { slug: string; path: string; title?: string };

export function MemoryView({
  raw,
  pageIndex,
}: {
  raw: string;
  pageIndex: PageIndexEntry[];
}) {
  const t = useTranslations("patients.memoryView");
  const parsed = useMemo(() => parseMemoryMarkdown(raw), [raw]);

  const synthesisSection = parsed.sections.find((s) =>
    /synth[èe]se|synthesis/i.test(s.heading)
  );
  const otherSections = parsed.sections.filter(
    (s) => s !== synthesisSection
  );

  function remapHeading(heading: string): string {
    const lower = heading.toLowerCase();
    if (
      lower === "timeline" ||
      lower === "parcours" ||
      lower === "historique" ||
      lower === "history"
    ) {
      return t("profileContext");
    }
    return heading;
  }

  return (
    <div className="flex flex-col gap-4">
      {parsed.inlineMeta.length > 0 && (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {parsed.inlineMeta.map((m) => (
            <div
              key={`${m.key}-${m.value}`}
              className="flex flex-col rounded-md border border-border bg-surface-muted/60 px-3 py-2"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {m.key}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {renderInlineValue(m.value, pageIndex)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {parsed.intro && (
        <SectionCard heading={t("overview")}>
          <VaultMarkdown raw={parsed.intro} pageIndex={pageIndex} />
        </SectionCard>
      )}

      {synthesisSection && (
        <SectionCard heading={synthesisSection.heading} highlight>
          <VaultMarkdown raw={synthesisSection.body} pageIndex={pageIndex} />
        </SectionCard>
      )}

      {otherSections.map((s) => (
        <SectionCard key={s.heading} heading={remapHeading(s.heading)}>
          <VaultMarkdown raw={s.body} pageIndex={pageIndex} />
        </SectionCard>
      ))}

      {parsed.sections.length === 0 && !parsed.intro && (
        <div className="rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-muted-foreground">
          {t("noEnrichment")}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  heading,
  highlight,
  children,
}: {
  heading: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border px-4 py-3.5",
        highlight
          ? "border-brand/30 bg-brand/[0.03]"
          : "border-border bg-surface"
      )}
    >
      <h3
        className={cn(
          "mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
          highlight ? "text-brand" : "text-muted-foreground"
        )}
      >
        {heading}
      </h3>
      {children}
    </section>
  );
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function renderInlineValue(
  value: string,
  pageIndex: PageIndexEntry[]
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of value.matchAll(WIKILINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(value.slice(last, idx));
    const slug = m[1].trim();
    const alias = m[2]?.trim() ?? null;
    const indexed = pageIndex.find((p) => p.slug === slug);
    const label = alias ?? indexed?.title ?? humanizeSlug(slug);
    if (indexed) {
      parts.push(
        <Link
          key={`v-${i}-${idx}`}
          href={`/admin/vault/${indexed.path.replace(/\.md$/, "")}`}
          className="text-brand hover:underline"
        >
          {label}
        </Link>
      );
    } else {
      parts.push(<Fragment key={`v-${i}-${idx}`}>{label}</Fragment>);
    }
    last = idx + m[0].length;
    i += 1;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts.length > 0 ? parts : value;
}
