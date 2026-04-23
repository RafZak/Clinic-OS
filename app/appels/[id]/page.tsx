import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default async function AppelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Appel ${id}`}
        description="Transcription + scoring 5 étapes téléphone + insights. Identique à la page consultation, framework adapté."
      />
      <PlaceholderBlock>Stretch goal J9.</PlaceholderBlock>
    </div>
  );
}
