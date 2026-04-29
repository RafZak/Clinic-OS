import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Nudge, NudgeKind, NudgeSeverity } from "@/lib/nudges";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<
  NudgeSeverity,
  {
    accent: string;
    iconBg: string;
    iconColor: string;
    Icon: typeof AlertTriangle;
  }
> = {
  info: {
    accent: "before:bg-sky-400",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    Icon: Lightbulb,
  },
  warning: {
    accent: "before:bg-amber-400",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-700",
    Icon: Sparkles,
  },
  critical: {
    accent: "before:bg-red-500",
    iconBg: "bg-red-50",
    iconColor: "text-red-700",
    Icon: AlertTriangle,
  },
};

export async function NudgesPanel({
  nudges,
  hiddenCount = 0,
}: {
  nudges: Nudge[];
  hiddenCount?: number;
}) {
  const t = await getTranslations("nudgesPanel");

  if (nudges.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  const alerts = nudges.filter((n) => n.kind === "alert");
  const improvements = nudges.filter((n) => n.kind === "improvement");

  return (
    <div className="flex flex-col gap-5">
      {alerts.length > 0 && (
        <NudgeGroup
          kind="alert"
          nudges={alerts}
          title={t("groupAlertTitle")}
        />
      )}
      {improvements.length > 0 && (
        <NudgeGroup
          kind="improvement"
          nudges={improvements}
          title={t("groupImprovementTitle")}
        />
      )}
      {hiddenCount > 0 && (
        <p className="-mt-2 text-right text-xs text-muted-foreground">
          {t("more", { count: hiddenCount })}
        </p>
      )}
    </div>
  );
}

function NudgeGroup({
  kind: _kind,
  nudges,
  title,
}: {
  kind: NudgeKind;
  nudges: Nudge[];
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
        <span className="ml-1.5 font-normal tabular-nums opacity-60">
          ({nudges.length})
        </span>
      </h3>
      <div
        className={cn(
          "grid grid-cols-1 gap-2.5",
          nudges.length >= 2 && "md:grid-cols-2"
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
  const { accent, iconBg, iconColor, Icon } = SEVERITY_STYLES[nudge.severity];

  const inner = (
    <div
      className={cn(
        "group relative flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface px-3.5 py-3 transition-all",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        accent,
        nudge.cta && "cursor-pointer hover:border-foreground/20 hover:shadow-sm"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          iconBg
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", iconColor)} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {nudge.title}
        </h4>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {nudge.description}
        </p>
        {nudge.cta && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand transition-colors group-hover:text-brand-dark">
            {nudge.cta.label}
            <ArrowUpRight className="h-3 w-3" />
          </p>
        )}
      </div>
    </div>
  );

  if (nudge.cta) {
    return (
      <Link href={nudge.cta.href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
