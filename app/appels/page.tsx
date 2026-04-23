import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default function AppelsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appels entrants"
        description="Historique des appels avec score, résultat (RDV pris / perdu) et durée. Framework 5 étapes téléphone."
      />
      <PlaceholderBlock>
        Stretch goal J9 — 2 replays d'appels seedés (converti 82/100 + perdu 38/100).
      </PlaceholderBlock>
    </div>
  );
}
