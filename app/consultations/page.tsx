import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default function ConsultationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultations"
        description="Historique des consultations analysées. Radar de performance par étape et accès rapide aux replays."
      />
      <PlaceholderBlock>
        Table des consultations (patient, score, étapes faibles, livrables) — branchée J6-J7.
      </PlaceholderBlock>
    </div>
  );
}
