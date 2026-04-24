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
import { startLiveSession } from "@/app/actions/sessions";
import type { Role } from "@/lib/role";

export function NewSessionButton({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = role === "audioprothesiste" ? "Nouvelle consultation" : "Nouvel appel";
  const kind = role === "audioprothesiste" ? "consultation" : "phone_call";

  const onLive = () => {
    startTransition(async () => {
      await startLiveSession(kind);
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {role === "audioprothesiste"
                ? "Démarrer une consultation en direct ou rejouer un cas-école."
                : "Réceptionner un appel en direct ou rejouer un appel enregistré."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-2">
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
                  {pending ? "Création de la session…" : "Démarrer en direct"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Micro + transcription Deepgram streaming — live coaching
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled
              className="flex items-start gap-3 rounded-md border border-dashed border-border bg-surface-muted px-4 py-3 text-left opacity-60"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted-foreground">
                <Radio className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">Rejouer une session</span>
                <span className="text-xs text-muted-foreground">
                  Les 3 cas-école seront disponibles à partir de J7.
                </span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
