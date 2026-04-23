"use client";

import { Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const SAMPLE_QUESTIONS = [
  "Comment demander une recommandation en cabine ?",
  "Comment traiter une objection prix classe 2 ?",
  "Script pour un appel entrant de prospect",
  "Les 3 thèmes du programme Un Cœur En Or",
];

export function SearchTrigger() {
  const [open, setOpen] = useState(false);

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
        <span className="flex-1 text-left">Rechercher une situation métier…</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Recherche knowledge</DialogTitle>
          <DialogDescription className="sr-only">
            Moteur de recherche sémantique sur les formations Audio Académie.
          </DialogDescription>
          <SearchBody onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "done" | "error"
  >("idle");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

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
      if (!res.body) throw new Error("Pas de stream renvoyé");

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
          placeholder="Une situation métier, une question, un mot-clé…"
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
        {status === "idle" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Exemples de questions
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUESTIONS.map((q) => (
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

        {submittedQuery && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand">
                <Sparkles className="size-3.5" aria-hidden />
                {status === "loading"
                  ? "Claude Haiku rassemble les sources…"
                  : status === "streaming"
                  ? "Synthèse en cours…"
                  : status === "error"
                  ? "Erreur"
                  : "Réponse"}
              </div>
              <div className="whitespace-pre-wrap text-sm text-ink">
                {answer}
                {status === "streaming" && (
                  <span className="inline-block h-4 w-[2px] translate-y-[2px] animate-pulse bg-brand" />
                )}
                {status === "loading" && !answer && (
                  <span className="text-muted-foreground">Recherche en cours…</span>
                )}
                {status === "error" && errorMsg && (
                  <span className="text-destructive">{errorMsg}</span>
                )}
              </div>
            </div>

            {sources.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sources ({sources.length})
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
