import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { StepHeatmap } from "@/components/dashboard/step-heatmap";
import { NudgesPanel } from "@/components/dashboard/nudges-panel";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { scoreTone, type ScoreTone } from "@/lib/score-tone";
import { loadDashboard, type DashboardKpi } from "@/lib/dashboard";
import { buildNudges } from "@/lib/nudges";
import { getRole } from "@/lib/role";
import { getLocale } from "@/lib/locale";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function kpiTone(kpi: DashboardKpi): ScoreTone {
  if (kpi.kind === "score" || kpi.kind === "callScore") {
    const match = kpi.value.match(/(\d+)\/100/);
    if (match) return scoreTone(parseInt(match[1], 10));
  }
  return "neutral";
}

export default async function DashboardPage() {
  const role = await getRole();
  const locale = await getLocale();
  const user = await getCurrentUser();
  const dashboard = await loadDashboard(role, locale);
  const nudgeBundle = await buildNudges(role, dashboard.context, locale);

  const tDash = await getTranslations("dashboard");
  const tRoles = await getTranslations("roles");

  const isPractitioner = role === "audioprothesiste";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          user
            ? tDash("welcome", { name: user.name })
            : tDash("title", { role: tRoles(role) })
        }
        description={
          isPractitioner
            ? tDash("descriptionPro")
            : tDash("descriptionAssistant")
        }
      />

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {dashboard.kpis.map((kpi) => (
          <KpiCard
            key={kpi.kind}
            kind={kpi.kind}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            tone={kpiTone(kpi)}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col rounded-lg border border-border bg-surface p-5 lg:col-span-7">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {tDash("heatmapTitle", { framework: dashboard.frameworkLabel })}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tDash("heatmapDescription")}
          </p>
          <div className="mt-5 flex-1">
            <StepHeatmap cells={dashboard.heatmap} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-5">
          <MiniCalendar grid={dashboard.calendar} locale={locale} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {tDash("actionsTitle")}
          </h2>
          {nudgeBundle.nudges.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {tDash("actionsCount", { count: nudgeBundle.nudges.length })}
            </span>
          )}
        </div>
        <div className="mt-4">
          <NudgesPanel
            nudges={nudgeBundle.nudges}
            hiddenCount={nudgeBundle.hiddenCount}
          />
        </div>
      </section>
    </div>
  );
}
