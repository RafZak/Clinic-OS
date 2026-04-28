"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { VaultMarkdown } from "@/components/admin/vault-markdown";
import { parseMemoryMarkdown } from "@/lib/vault/parse-sections";
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

  return (
    <div className="flex flex-col gap-4">
      {synthesisSection ? (
        <SectionCard heading={synthesisSection.heading} highlight>
          <VaultMarkdown raw={synthesisSection.body} pageIndex={pageIndex} />
        </SectionCard>
      ) : (
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

