import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import type { Nudge, NudgeKind, NudgeSeverity } from "@/lib/nudges";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<NudgeSeverity, { card: string; icon: string; Icon: typeof AlertTriangle }> = {
  info: {
    card: "border-border bg-surface",
    icon: "text-sky-600",
    Icon: Lightbulb,
  },
  warning: {
    card: "border-amber-200 bg-amber-50/60",
    icon: "text-amber-700",
    Icon: Sparkles,
  },
  critical: {
    card: "border-red-200 bg-red-50/60",
    icon: "text-red-700",
    Icon: AlertTriangle,
  },
};

const GROUP_TITLE: Record<NudgeKind, string> = {
  alert: "Alertes & relances",
  improvement: "Axes d'amélioration",
};

const GROUP_DESCRIPTION: Record<NudgeKind, string> = {
  alert:
    "Actions concrètes à mener maintenant — patients à rappeler, RDV à confirmer, livrables à valider.",
  improvement:
    "Suggestions de coaching basées sur vos sessions analysées et la mémoire organisationnelle.",
};

export function NudgesPanel({ nudges }: { nudges: Nudge[] }) {
  if (nudges.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-muted-foreground">
        Aucune action recommandée pour l&apos;instant.
      </div>
    );
  }

  const alerts = nudges.filter((n) => n.kind === "alert");
  const improvements = nudges.filter((n) => n.kind === "improvement");

  return (
    <div className="flex flex-col gap-6">
      {alerts.length > 0 && <NudgeGroup kind="alert" nudges={alerts} />}
      {improvements.length > 0 && (
        <NudgeGroup kind="improvement" nudges={improvements} />
      )}
    </div>
  );
}

function NudgeGroup({ kind, nudges }: { kind: NudgeKind; nudges: Nudge[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
          {GROUP_TITLE[kind]}
        </h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {nudges.length}
        </span>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        {GROUP_DESCRIPTION[kind]}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {nudges.map((nudge) => (
          <NudgeCard key={nudge.id} nudge={nudge} />
        ))}
      </div>
    </div>
  );
}

function NudgeCard({ nudge }: { nudge: Nudge }) {
  const { card, icon, Icon } = SEVERITY_STYLES[nudge.severity];
  return (
    <div
      className={cn("flex flex-col gap-2 rounded-lg border px-4 py-3.5", card)}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold leading-snug">{nudge.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {nudge.description}
          </p>
        </div>
      </div>
      {nudge.cta && (
        <div className="-mb-1 flex justify-end">
          <Link
            href={nudge.cta.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
          >
            {nudge.cta.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
