"use client";

import { useTransition } from "react";
import { Download, Shield, ShieldOff } from "lucide-react";
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

  const handleClick = () => {
    startTransition(async () => {
      if (active) await revokeConsentAction(patientId);
      else await grantConsentAction(patientId);
    });
  };

  const tooltip = active
    ? `Consentement actif depuis le ${consentAt!.toLocaleDateString("fr-FR")}. Le profil psychologique de ce patient peut être inclus dans les exports CSV et les segments de campagne marketing.`
    : revokedAt
      ? `Consentement révoqué le ${revokedAt.toLocaleDateString("fr-FR")}. Profil exclu des exports.`
      : "Consentement non recueilli. Profil exclu des exports marketing tant que le patient n'a pas opt-in.";

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
        Consent. marketing : {active ? "activé" : "désactivé"}
      </button>
      {active && (
        <a
          href={`/admin/psychology/export?ids=${patientId}&consent=active`}
          download
          title="Télécharger le profil psychologique de ce patient au format CSV (1 ligne)"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
        >
          <Download className="h-3.5 w-3.5" />
          Exporter ce profil
        </a>
      )}
    </div>
  );
}
