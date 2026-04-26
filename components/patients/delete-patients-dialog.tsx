"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("patients.deleteDialog");
  const tPatients = useTranslations("patients");
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
          <DialogTitle>{t("title", { count: patientIds.length })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {previewLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("computingImpact")}
            </div>
          )}
          {previewError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
              {t("previewError", { error: previewError })}
            </div>
          )}
          {preview && (
            <>
              {visibleLabels.length > 0 && (
                <div className="rounded-md border border-border bg-surface-muted p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("concernedLabel", { count: visibleLabels.length })}
                  </p>
                  <p className="text-sm">
                    {visibleLabels.join(" · ")}
                    {hiddenLabels > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        {t("moreOthers", { count: hiddenLabels })}
                      </span>
                    )}
                  </p>
                </div>
              )}
              <ul className="space-y-1.5 rounded-md border border-border bg-surface p-3">
                <ImpactRow
                  label={t("impactSessions")}
                  value={preview.consultationsCount + preview.phoneCallsCount}
                  detail={[
                    preview.consultationsCount > 0
                      ? t("impactSessionsDetailConsultation", { count: preview.consultationsCount })
                      : null,
                    preview.phoneCallsCount > 0
                      ? t("impactSessionsDetailPhone", { count: preview.phoneCallsCount })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
                <ImpactRow label={t("impactEvents")} value={preview.eventsCount} />
                <ImpactRow
                  label={t("impactVault")}
                  value={preview.vaultPagesCount}
                  detail={t("impactVaultDetail")}
                />
                <ImpactRow
                  label={t("impactAudio")}
                  value={preview.audioFilesCount}
                  detail={t("impactAudioDetail")}
                />
              </ul>
            </>
          )}
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
              {t("submitError", { error: submitError })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tPatients("deleteCancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending || previewLoading || patientIds.length === 0}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tPatients("deleting")}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {tPatients("deleteConfirm")}
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
