"use client";

import { useTransition } from "react";
import { Download, Shield, ShieldOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  grantConsentAction,
  revokeConsentAction,
} from "@/app/actions/psychology";

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
        <a
          href={`/admin/psychology/export?ids=${patientId}&consent=active`}
          download
          title={t("exportProfileTooltip")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
        >
          <Download className="h-3.5 w-3.5" />
          {t("exportProfile")}
        </a>
      )}
    </div>
  );
}
