"use client";

import { Mic, Plus, Radio } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startLiveSession, startReplaySession } from "@/app/actions/sessions";
import { REPLAY_SCENARIOS } from "@/scripts/replay/scripts";
import { REPLAY_PHONE_SCENARIOS } from "@/scripts/replay/scripts-phone";
import type { Role } from "@/lib/role";

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m${s.toString().padStart(2, "0")}`;
}

export function NewSessionButton({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [replayPendingSlug, setReplayPendingSlug] = useState<string | null>(null);
  const label = role === "audioprothesiste" ? "Nouvelle consultation" : "Nouvel appel";
  const kind = role === "audioprothesiste" ? "consultation" : "phone_call";

  const onLive = () => {
    startTransition(async () => {
      await startLiveSession(kind);
    });
  };

  const onReplay = (slug: string) => {
    setReplayPendingSlug(slug);
    startTransition(async () => {
      await startReplaySession(slug);
    });
  };

  return (
    <>
      <Button
        size="sm"
        className="bg-brand text-primary-foreground hover:bg-brand-dark"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {role === "audioprothesiste"
                ? "Démarrer une consultation en direct ou rejouer un cas-école."
                : "Réceptionner un appel en direct ou rejouer un cas-école."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 pt-2">
            <button
              type="button"
              onClick={onLive}
              disabled={pending}
              className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left transition hover:border-brand hover:bg-brand/5 disabled:opacity-50"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Mic className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">
                  {pending && !replayPendingSlug
                    ? "Création de la session…"
                    : "Démarrer en direct"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Micro + transcription en direct — coaching IA pendant la consultation
                </span>
              </span>
            </button>

            {role === "audioprothesiste" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Radio className="size-3.5" aria-hidden />
                  Rejouer un cas-école
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {REPLAY_SCENARIOS.map((scenario) => {
                    const isPending = pending && replayPendingSlug === scenario.slug;
                    return (
                      <button
                        key={scenario.slug}
                        type="button"
                        onClick={() => onReplay(scenario.slug)}
                        disabled={pending}
                        className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-left transition hover:border-brand hover:bg-brand/5 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">
                            {scenario.patientLabel.replace(/^Mme |^M\. /, "")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
                            {scenario.targetScore}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {scenario.label.split("—")[1]?.trim() ?? scenario.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDuration(scenario.targetDurationSeconds)}
                          {isPending ? " · lancement…" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {role === "assistant" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Radio className="size-3.5" aria-hidden />
                  Rejouer un appel-école
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REPLAY_PHONE_SCENARIOS.map((scenario) => {
                    const isPending = pending && replayPendingSlug === scenario.slug;
                    return (
                      <button
                        key={scenario.slug}
                        type="button"
                        onClick={() => onReplay(scenario.slug)}
                        disabled={pending}
                        className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-left transition hover:border-brand hover:bg-brand/5 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">
                            {scenario.callerLabel.replace(/^Mme |^M\. /, "")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
                            {scenario.targetScore}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {scenario.label.split("—")[1]?.trim() ?? scenario.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDuration(scenario.targetDurationSeconds)}
                          {isPending ? " · lancement…" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
