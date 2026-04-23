"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Role } from "@/lib/role";

export function NewSessionButton({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const label = role === "audioprothesiste" ? "Nouvelle consultation" : "Nouvel appel";

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
                ? "Démarrer une consultation live ou charger un replay. Disponible à partir de J5."
                : "Réceptionner un appel entrant ou rejouer un appel enregistré. Stretch goal prévu pour J9."}
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
