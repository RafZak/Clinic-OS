import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Consultation ${id}`}
        description="3 colonnes live (transcription + scoring 10 étapes + insights) ou page résultats (radar + 4 artefacts)."
      />
      <PlaceholderBlock>
        Mode live J5-J6 · Page résultats + 4 artefacts J8 · Vue mémoire vers fiche Karpathy J8.
      </PlaceholderBlock>
    </div>
  );
}
