"use client";

import { useTransition } from "react";
import { Shield, ShieldOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  grantConsentAction,
  revokeConsentAction,
} from "@/app/actions/psychology";
import { ExportFormatMenu } from "@/components/exports/export-format-menu";

type Props = {
  patientId: string;
  consentAt: Date | null;
  revokedAt: Date | null;
};

function isActive(consentAt: Date | null, revokedAt: Date | null): boolean {
  if (!consentAt) return false;
  if (!revokedAt) return true;
  return consentAt.getTime() > revokedAt.getTime();
}

export function MarketingConsentToggle({
  patientId,
  consentAt,
  revokedAt,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const active = isActive(consentAt, revokedAt);
  const t = useTranslations("psychology");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";

  const handleClick = () => {
    startTransition(async () => {
      if (active) await revokeConsentAction(patientId);
      else await grantConsentAction(patientId);
    });
  };

  const tooltip = active
    ? t("consentEnabledTooltip", { date: consentAt!.toLocaleDateString(dateLocale) })
    : revokedAt
      ? t("consentRevokedTooltip", { date: revokedAt.toLocaleDateString(dateLocale) })
      : t("consentMissingTooltip");

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={tooltip}
        className={
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 " +
          (active
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-border bg-surface text-muted-foreground hover:bg-surface-muted")
        }
      >
        {active ? (
          <Shield className="h-3.5 w-3.5" />
        ) : (
          <ShieldOff className="h-3.5 w-3.5" />
        )}
        {active ? t("consentEnabled") : t("consentDisabled")}
      </button>
      {active && (
        <ExportFormatMenu
          exportableCount={1}
          compact
          buildUrl={(format, exportLocale) => {
            const url = new URL("/api/exports/patients", window.location.origin);
            url.searchParams.set("ids", patientId);
            url.searchParams.set("consent", "active");
            url.searchParams.set("format", format);
            url.searchParams.set("locale", exportLocale);
            return url.toString();
          }}
        />
      )}
    </div>
  );
}
