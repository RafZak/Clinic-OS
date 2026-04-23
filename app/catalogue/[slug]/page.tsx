import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Programme — ${slug}`}
        description="Header programme + modules en accordéon (description, player vidéo, livrets PDF)."
      />
      <PlaceholderBlock>
        Contenu chargé depuis la base après ingestion Drive J3.
      </PlaceholderBlock>
    </div>
  );
}
