import { PageHeader } from "@/components/layout/page-header";
import { WeeklyScoreChart } from "@/components/dashboard/weekly-score-chart";
import { StepHeatmap } from "@/components/dashboard/step-heatmap";
import { RecentSessionsTable } from "@/components/dashboard/recent-sessions-table";
import { NudgesPanel } from "@/components/dashboard/nudges-panel";
import { loadDashboard } from "@/lib/dashboard";
import { buildNudges } from "@/lib/nudges";
import { getRole, ROLE_LABEL } from "@/lib/role";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const role = await getRole();
  const dashboard = await loadDashboard(role);
  const nudges = buildNudges(role, dashboard.context);

  const isPractitioner = role === "audioprothesiste";
  const kpiCount = dashboard.kpis.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Tableau de bord — ${ROLE_LABEL[role]}`}
        description={
          isPractitioner
            ? "Taux de concrétisation, panier moyen et qualité de vos consultations — actions recommandées par Clinic OS."
            : "Durée moyenne et qualité de vos appels — actions recommandées par Clinic OS."
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

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Évolution score {dashboard.frameworkLabel.toLowerCase()} — 4 semaines
            </h2>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-4">
            <WeeklyScoreChart points={dashboard.weekly} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Performance par étape — Framework {dashboard.frameworkLabel}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Score moyen par étape sur les sessions analysées.
          </p>
          <div className="mt-4">
            <StepHeatmap cells={dashboard.heatmap} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Actions recommandées
        </h2>
        <div className="mt-4">
          <NudgesPanel nudges={nudges} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Dernières {isPractitioner ? "consultations analysées" : "appels analysés"}
        </h2>
        <RecentSessionsTable
          rows={dashboard.recentSessions}
          kind={dashboard.frameworkKind}
        />
      </section>
    </div>
  );
}
