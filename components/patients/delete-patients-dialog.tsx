"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  deletePatients,
  previewDeletePatients,
  type DeletePatientsPreview,
  type DeletePatientsResult,
} from "@/app/actions/patients";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientIds: string[];
  onDeleted?: (result: DeletePatientsResult) => void;
};

export function DeletePatientsDialog({
  open,
  onOpenChange,
  patientIds,
  onDeleted,
}: Props) {
  const [preview, setPreview] = useState<DeletePatientsPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || patientIds.length === 0) {
      setPreview(null);
      setPreviewError(null);
      setSubmitError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    previewDeletePatients(patientIds)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((e) => {
        if (!cancelled)
          setPreviewError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, patientIds]);

  function handleConfirm() {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const res = await deletePatients(patientIds);
        onDeleted?.(res);
        onOpenChange(false);
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const labelPreview = preview?.patientLabels ?? [];
  const showAllLabels = labelPreview.length <= 5;
  const visibleLabels = showAllLabels
    ? labelPreview
    : labelPreview.slice(0, 4);
  const hiddenLabels = showAllLabels ? 0 : labelPreview.length - 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Supprimer {patientIds.length === 1 ? "ce patient" : `${patientIds.length} patients`}
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Toutes les données liées sont
            effacées de la base et du stockage audio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {previewLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calcul de l'impact…
            </div>
          )}
          {previewError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
              Impossible de prévisualiser : {previewError}
            </div>
          )}
          {preview && (
            <>
              {visibleLabels.length > 0 && (
                <div className="rounded-md border border-border bg-surface-muted p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Patient{visibleLabels.length > 1 ? "s" : ""} concerné
                    {visibleLabels.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm">
                    {visibleLabels.join(" · ")}
                    {hiddenLabels > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        + {hiddenLabels} autre{hiddenLabels > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
              )}
              <ul className="space-y-1.5 rounded-md border border-border bg-surface p-3">
                <ImpactRow
                  label="Sessions"
                  value={preview.consultationsCount + preview.phoneCallsCount}
                  detail={[
                    preview.consultationsCount > 0
                      ? `${preview.consultationsCount} consultation${preview.consultationsCount > 1 ? "s" : ""}`
                      : null,
                    preview.phoneCallsCount > 0
                      ? `${preview.phoneCallsCount} appel${preview.phoneCallsCount > 1 ? "s" : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
                <ImpactRow
                  label="Événements timeline"
                  value={preview.eventsCount}
                />
                <ImpactRow
                  label="Fiches vault"
                  value={preview.vaultPagesCount}
                  detail="patient + sessions"
                />
                <ImpactRow
                  label="Fichiers audio"
                  value={preview.audioFilesCount}
                  detail="Supabase Storage"
                />
              </ul>
            </>
          )}
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
              Erreur : {submitError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending || previewLoading || patientIds.length === 0}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Confirmer la suppression
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImpactRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-semibold tabular-nums">{value}</span>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </span>
    </li>
  );
}
