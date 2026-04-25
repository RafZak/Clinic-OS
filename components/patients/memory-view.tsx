"use client";

import { useMemo } from "react";
import { VaultMarkdown } from "@/components/admin/vault-markdown";
import { parseMemoryMarkdown } from "@/lib/vault/parse-sections";
import { cn } from "@/lib/utils";

type PageIndexEntry = { slug: string; path: string };

export function MemoryView({
  raw,
  pageIndex,
}: {
  raw: string;
  pageIndex: PageIndexEntry[];
}) {
  const parsed = useMemo(() => parseMemoryMarkdown(raw), [raw]);

  const synthesisSection = parsed.sections.find((s) =>
    /synth[èe]se/i.test(s.heading)
  );
  const otherSections = parsed.sections.filter(
    (s) => s !== synthesisSection
  );

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
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {parsed.intro && (
        <SectionCard heading="Aperçu">
          <VaultMarkdown raw={parsed.intro} pageIndex={pageIndex} />
        </SectionCard>
      )}

      {synthesisSection && (
        <SectionCard heading={synthesisSection.heading} highlight>
          <VaultMarkdown raw={synthesisSection.body} pageIndex={pageIndex} />
        </SectionCard>
      )}

      {otherSections.map((s) => (
        <SectionCard key={s.heading} heading={s.heading}>
          <VaultMarkdown raw={s.body} pageIndex={pageIndex} />
        </SectionCard>
      ))}

      {parsed.sections.length === 0 && !parsed.intro && (
        <div className="rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-muted-foreground">
          Fiche en cours d&apos;enrichissement — une session analysée permettra
          d&apos;ajouter des sections détaillées.
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
