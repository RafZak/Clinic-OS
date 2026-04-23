import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default function AdminKnowledgePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin — Knowledge Layer A"
        description="Pipeline d'ingestion Google Drive, table des chunks vectoriels, test de retrieval et historique des runs."
      />
      <PlaceholderBlock>
        Implémentation J3 : bouton Re-ingérer, upload manuel, filtres par programme, scoring top-5.
      </PlaceholderBlock>
    </div>
  );
}
