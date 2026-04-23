import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";
import { getRole, ROLE_LABEL } from "@/lib/role";

export default async function DashboardPage() {
  const role = await getRole();
  const isPractitioner = role === "audioprothesiste";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Tableau de bord — ${ROLE_LABEL[role]}`}
        description={
          isPractitioner
            ? "KPIs business, évolution de vos taux d'appareillage et actions recommandées par Clinic OS."
            : "KPIs de transformation d'appels, durée moyenne, qualité d'accueil et actions recommandées."
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {(isPractitioner
          ? [
              { label: "Taux d'appareillage", value: "—" },
              { label: "Panier moyen", value: "—" },
              { label: "Taux de conversion", value: "—" },
              { label: "Score consultations", value: "—" },
            ]
          : [
              { label: "Taux appel → RDV", value: "—" },
              { label: "Durée moyenne appel", value: "—" },
              { label: "Taux RDV honorés", value: "—" },
              { label: "Score qualité accueil", value: "—" },
            ]
        ).map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{kpi.value}</p>
          </div>
        ))}
      </div>

      <PlaceholderBlock>
        Graphiques + heatmap framework + actions recommandées — à brancher sur les seeds J9.
      </PlaceholderBlock>
    </div>
  );
}
