"use client";

import {
  ArrowRight,
  GraduationCap,
  Layers,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Source = {
  id: string;
  sourceFile: string;
  sourceType: string;
  programSlug: string | null;
  moduleNumber: number | null;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown> | null;
  driveFileId: string | null;
  similarity: number;
};

type StreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "text"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };

type NavItem = {
  type: "patient" | "program" | "module";
  id: string;
  label: string;
  subtitle: string;
  href: string;
};

const TYPE_ICON = {
  patient: User,
  program: GraduationCap,
  module: Layers,
} as const;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function filterItems(items: NavItem[], q: string): NavItem[] {
  if (!q) return [];
  const needle = normalize(q.trim());
  if (!needle) return [];
  const scored: { item: NavItem; score: number }[] = [];
  for (const item of items) {
    const hay = normalize(`${item.label} ${item.subtitle}`);
    const idx = hay.indexOf(needle);
    if (idx === -1) continue;
    scored.push({ item, score: idx });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.item);
}

export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("search");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-3 rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">{t("placeholderTrigger")}</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("description")}
          </DialogDescription>
          <SearchBody onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "done" | "error"
  >("idle");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [navIndex, setNavIndex] = useState<NavItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const examples = t.raw("examples") as string[];

  useEffect(() => {
    const tt = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(tt);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/search/index")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.items) return;
        setNavIndex(data.items as NavItem[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => filterItems(navIndex, query), [navIndex, query]);
  const grouped = useMemo(() => {
    const max = 5;
    return {
      patients: filtered.filter((i) => i.type === "patient").slice(0, max),
      programs: filtered.filter((i) => i.type === "program").slice(0, max),
      modules: filtered.filter((i) => i.type === "module").slice(0, max),
    };
  }, [filtered]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSubmittedQuery(trimmed);
    setStatus("loading");
    setAnswer("");
    setSources([]);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No stream returned");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      setStatus("streaming");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, "").trim();
          if (!payload) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(payload) as StreamEvent;
          } catch {
            continue;
          }
          if (evt.type === "sources") setSources(evt.sources);
          else if (evt.type === "text") setAnswer((prev) => prev + evt.delta);
          else if (evt.type === "done") setStatus("done");
          else if (evt.type === "error") {
            setErrorMsg(evt.message);
            setStatus("error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  function handleNavigate(href: string) {
    onClose();
    router.push(href);
  }

  const hasNavResults =
    grouped.patients.length + grouped.programs.length + grouped.modules.length >
    0;
  const trimmedQuery = query.trim();
  const canAskCoach = trimmedQuery.length >= 3;

  return (
    <div className="flex max-h-[80vh] flex-col">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-3 border-b border-border px-4 py-3"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("placeholderInput")}
          className="flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ↵
        </kbd>
      </form>

      <div className="min-h-[260px] flex-1 overflow-y-auto px-4 py-4">
        {status === "idle" && !trimmedQuery && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("examplesLabel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuery(q);
                    void runSearch(q);
                  }}
                  className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {trimmedQuery && (
          <div className="flex flex-col gap-4">
            {hasNavResults && (
              <div className="flex flex-col gap-3">
                <NavGroup
                  label={t("groupPatients")}
                  items={grouped.patients}
                  onNavigate={handleNavigate}
                />
                <NavGroup
                  label={t("groupPrograms")}
                  items={grouped.programs}
                  onNavigate={handleNavigate}
                />
                <NavGroup
                  label={t("groupModules")}
                  items={grouped.modules}
                  onNavigate={handleNavigate}
                />
              </div>
            )}

            {canAskCoach && status === "idle" && (
              <button
                type="button"
                onClick={() => void runSearch(query)}
                className="flex items-center gap-3 rounded-md border border-dashed border-brand/40 bg-brand/5 px-3 py-2.5 text-left transition-colors hover:bg-brand/10"
              >
                <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {t("askCoach")}{" "}
                    <span className="text-muted-foreground">
                      « {trimmedQuery} »
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("askCoachHint")}
                  </p>
                </div>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </button>
            )}

            {!hasNavResults && status === "idle" && !canAskCoach && (
              <p className="text-xs italic text-muted-foreground">
                {t("noResults")}
              </p>
            )}
          </div>
        )}

        {submittedQuery && status !== "idle" && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand">
                <Sparkles className="size-3.5" aria-hidden />
                {status === "loading"
                  ? t("loading")
                  : status === "streaming"
                  ? t("streaming")
                  : status === "error"
                  ? tCommon("error")
                  : t("answer")}
              </div>
              <div className="whitespace-pre-wrap text-sm text-ink">
                {answer}
                {status === "streaming" && (
                  <span className="inline-block h-4 w-[2px] translate-y-[2px] animate-pulse bg-brand" />
                )}
                {status === "loading" && !answer && (
                  <span className="text-muted-foreground">{t("searching")}</span>
                )}
                {status === "error" && errorMsg && (
                  <span className="text-destructive">{errorMsg}</span>
                )}
              </div>
            </div>

            {sources.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("sources", { count: sources.length })}
                </p>
                <ol className="flex flex-col gap-1.5">
                  {sources.map((s, idx) => (
                    <li
                      key={s.id}
                      className={cn(
                        "grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-xs"
                      )}
                    >
                      <span className="font-mono text-muted-foreground">
                        [{idx + 1}]
                      </span>
                      <span className="truncate">
                        <span className="font-medium text-ink">{s.sourceFile}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {s.programSlug ?? "—"}
                          {s.moduleNumber ? ` · module ${s.moduleNumber}` : ""}
                        </span>
                      </span>
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-brand">
                        {s.similarity.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  onNavigate: (href: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = TYPE_ICON[item.type];
          return (
            <li key={`${item.type}-${item.id}`}>
              <Link
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.href);
                }}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-muted"
              >
                <Icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink">{item.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                </span>
                <ArrowRight
                  className="size-3.5 shrink-0 text-muted-foreground/60"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
