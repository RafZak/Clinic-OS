import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";

export default function CataloguePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Catalogue de formation"
        description="10 programmes — 4 actifs (Recommandation, Personnel Accueil, Convaincre au téléphone, Audio Vente) et 6 à venir."
      />
      <PlaceholderBlock>
        Grille de 10 cartes par catégorie, clin d'œil visuel à AUDIO Académie. Branchée J4.
      </PlaceholderBlock>
    </div>
  );
}
