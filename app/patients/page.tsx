import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default function PatientsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patients"
        description="Parcours complet de chaque patient du centre : appels, consultations, essais, livraisons et suivis."
      />
      <PlaceholderBlock>
        2 patients fictifs complets (Mme Durand, M. Martin) seedés en J9.
      </PlaceholderBlock>
    </div>
  );
}
