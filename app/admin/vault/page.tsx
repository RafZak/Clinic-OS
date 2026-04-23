import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default function AdminVaultPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin — Vault Layer B"
        description="Mémoire organisationnelle pattern Karpathy : fiches audioprothésistes, assistants, centres, patients, patterns. Backlinks + export Obsidian."
      />
      <PlaceholderBlock>
        Implémentation J8 : rendu markdown, wikilinks cliquables, graph view, export .zip Obsidian.
      </PlaceholderBlock>
    </div>
  );
}
