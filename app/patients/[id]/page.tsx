import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Patient ${id}`}
        description="Timeline verticale du parcours (appel → RDV → consult → essai → livraison → suivi). Panneau latéral : fiche Karpathy patient."
      />
      <PlaceholderBlock>
        Timeline branchée J9 sur données seedées. Événements cliquables → replay + analyse.
      </PlaceholderBlock>
    </div>
  );
}
