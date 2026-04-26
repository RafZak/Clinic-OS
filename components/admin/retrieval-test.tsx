"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { runRetrievalTest, type SearchState } from "@/app/admin/knowledge/actions";

const INITIAL: SearchState = { query: "", results: [] };

export function RetrievalTest() {
  const t = useTranslations("admin.knowledge");
  const [state, action, pending] = useActionState(runRetrievalTest, INITIAL);
  const samples = (t.raw("retrievalSamples") as string[]) ?? [];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div>
        <h2 className="text-base font-semibold">{t("retrievalTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("retrievalDescription")}</p>
      </div>

      <form action={action} className="flex gap-2">
        <Input
          name="query"
          defaultValue={state.query}
          placeholder={t("retrievalPlaceholder")}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={pending}
          className="bg-brand text-primary-foreground hover:bg-brand-dark"
        >
          <Search className="size-4" aria-hidden />
          {pending ? t("retrievalSearching") : t("retrievalSearch")}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {samples.map((q) => (
          <form key={q} action={action}>
            <input type="hidden" name="query" value={q} />
            <button
              type="submit"
              className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
            >
              {q}
            </button>
          </form>
        ))}
      </div>

      {state.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.query && !state.error && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("retrievalCount", {
              count: state.results.length,
              ms: state.durationMs ?? 0,
            })}
          </span>
          <span>{t("retrievalQueryLabel", { query: state.query })}</span>
        </div>
      )}

      {state.results.length > 0 && (
        <ol className="flex flex-col gap-2">
          {state.results.map((r, idx) => (
            <li
              key={r.id}
              className={cn(
                "rounded-md border border-border bg-surface-muted px-4 py-3 text-sm"
              )}
            >
              <div className="mb-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono text-ink">#{idx + 1}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-brand">
                  {r.similarity.toFixed(3)}
                </span>
                <span className="truncate">
                  {r.programSlug ?? "—"}
                  {r.moduleNumber ? ` · module ${r.moduleNumber}` : ""}
                </span>
                <span className="ml-auto truncate text-[11px]">
                  {r.sourceType} · {r.sourceFile}
                </span>
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap text-ink/90">
                {r.content}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
