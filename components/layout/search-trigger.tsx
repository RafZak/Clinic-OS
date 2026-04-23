"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Recherche knowledge</DialogTitle>
            <DialogDescription>
              Moteur de recherche sémantique sur les formations. Disponible à partir de J4
              — retrieval voyage-3-lite + synthèse Claude Haiku en streaming.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
            Bientôt disponible
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
