import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { WeeklyScoreChart } from "@/components/dashboard/weekly-score-chart";
import { StepHeatmap } from "@/components/dashboard/step-heatmap";
import { NudgesPanel } from "@/components/dashboard/nudges-panel";
import { loadDashboard } from "@/lib/dashboard";
import { buildNudges } from "@/lib/nudges";
import { getRole } from "@/lib/role";
import { getLocale } from "@/lib/locale";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const role = await getRole();
  const locale = await getLocale();
  const user = await getCurrentUser();
  const dashboard = await loadDashboard(role, locale);
  const nudges = await buildNudges(role, dashboard.context, locale);

  const tDash = await getTranslations("dashboard");
  const tRoles = await getTranslations("roles");

  const isPractitioner = role === "audioprothesiste";
  const kpiCount = dashboard.kpis.length;

  return (
    <div className="flex flex-col gap-6">
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
        className={cn(
          "grid grid-cols-1 gap-4",
          kpiCount === 2 && "md:max-w-3xl md:grid-cols-2",
          kpiCount === 3 && "md:grid-cols-3",
          kpiCount >= 4 && "md:grid-cols-4"
        )}
      >
        {dashboard.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {kpi.value}
            </p>
            {kpi.hint && (
              <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
            )}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {tDash("weeklyTitle", {
                framework: dashboard.frameworkLabel.toLowerCase(),
              })}
            </h2>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-4">
            <WeeklyScoreChart points={dashboard.weekly} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {tDash("heatmapTitle", { framework: dashboard.frameworkLabel })}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {tDash("heatmapDescription")}
          </p>
          <div className="mt-4">
            <StepHeatmap cells={dashboard.heatmap} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {tDash("actionsTitle")}
        </h2>
        <div className="mt-4">
          <NudgesPanel nudges={nudges} />
        </div>
      </section>
    </div>
  );
}
