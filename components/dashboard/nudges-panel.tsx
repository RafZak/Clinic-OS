import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
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

export async function NudgesPanel({ nudges }: { nudges: Nudge[] }) {
  const t = await getTranslations("nudgesPanel");

  if (nudges.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  const alerts = nudges.filter((n) => n.kind === "alert");
  const improvements = nudges.filter((n) => n.kind === "improvement");

  return (
    <div className="flex flex-col gap-6">
      {alerts.length > 0 && (
        <NudgeGroup
          kind="alert"
          nudges={alerts}
          title={t("groupAlertTitle")}
          description={t("groupAlertDescription")}
        />
      )}
      {improvements.length > 0 && (
        <NudgeGroup
          kind="improvement"
          nudges={improvements}
          title={t("groupImprovementTitle")}
          description={t("groupImprovementDescription")}
        />
      )}
    </div>
  );
}

function NudgeGroup({
  kind,
  nudges,
  title,
  description,
}: {
  kind: NudgeKind;
  nudges: Nudge[];
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
          {title}{" "}
          <span className="ml-1 font-normal tabular-nums text-muted-foreground">
            ({nudges.length})
          </span>
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          nudges.length >= 2 && "md:grid-cols-2 md:auto-rows-fr"
        )}
      >
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
        <div className="-mb-1 mt-auto flex justify-end pt-1">
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
