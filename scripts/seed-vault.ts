import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import {
  centers,
  practitioners,
  patients,
  vaultPages,
} from "../db/schema";
import {
  serializeFrontmatter,
  type VaultMetadata,
} from "../lib/vault/frontmatter";
import { extractWikilinks } from "../lib/vault/wikilinks";
import { writeVaultFile, ensureVaultBucket } from "../lib/vault/storage";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type SeedPage = {
  path: string;
  kind: "practitioner" | "center" | "patient" | "pattern" | "index";
  title: string;
  metadata: VaultMetadata;
  body: string;
  entityResolver?: () => string | null;
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const dbi = drizzle(client);

  console.log("→ Seed vault Karpathy");

  await ensureVaultBucket();

  // Lookup entités déjà seedées par seed-replay.
  const [center] = await dbi
    .select()
    .from(centers)
    .where(eq(centers.name, "Lyon 3"))
    .limit(1);
  if (!center) {
    console.error("✗ Centre 'Lyon 3' introuvable. Lancez d'abord pnpm seed:replay.");
    process.exit(1);
  }

  const [practitioner] = await dbi
    .select()
    .from(practitioners)
    .where(
      and(
        eq(practitioners.fullName, "Jonathan Goldminc"),
        eq(practitioners.centerId, center.id)
      )
    )
    .limit(1);
  if (!practitioner) {
    console.error(
      "✗ Audioprothésiste 'Jonathan Goldminc' introuvable. Lancez d'abord pnpm seed:replay."
    );
    process.exit(1);
  }

  const patientRows = await dbi
    .select()
    .from(patients)
    .where(eq(patients.centerId, center.id));
  const byLabel = new Map(patientRows.map((p) => [p.label, p]));
  const durand = byLabel.get("Mme Françoise Durand");
  const martin = byLabel.get("M. Henri Martin");
  const lefevre = byLabel.get("Mme Isabelle Lefèvre");

  if (!durand || !martin || !lefevre) {
    console.error(
      "✗ Patients seedés introuvables (Durand / Martin / Lefèvre). Lancez d'abord pnpm seed:replay."
    );
    process.exit(1);
  }

  const today = new Date().toISOString();

  const pages: SeedPage[] = [
    {
      path: "index.md",
      kind: "index",
      title: "Vault — Mémoire organisationnelle",
      metadata: { type: "index", updated_at: today },
      body: `# Vault — Mémoire organisationnelle

Chaque session analysée enrichit cette mémoire vivante du réseau.

## Audioprothésistes
- [[jonathan-goldminc]]

## Centres
- [[lyon-3]]

## Patients suivis
- [[mme-francoise-durand]]
- [[m-henri-martin]]
- [[mme-isabelle-lefevre]]

## Patterns détectés
- [[objection-prix-non-traitee]]
`,
    },
    {
      path: `centers/${slugify(center.name)}.md`,
      kind: "center",
      title: `Centre ${center.name}`,
      metadata: {
        type: "center",
        entity_id: center.id,
        sessions_analyzed: 0,
        avg_score: 0,
        trend: "stable",
        updated_at: today,
      },
      body: `# Centre ${center.name}

**Ville** : ${center.city ?? "Lyon"}
**Audioprothésistes** : [[jonathan-goldminc]]

## Synthèse

Centre fictif de démonstration. Les fiches d'équipe et les patterns de centre s'enrichiront automatiquement à mesure que des sessions sont analysées.

## Sessions récentes

_Aucune session analysée pour l'instant._
`,
    },
    {
      path: `practitioners/${slugify(practitioner.fullName)}.md`,
      kind: "practitioner",
      title: `Dr ${practitioner.fullName}`,
      metadata: {
        type: "practitioner",
        entity_id: practitioner.id,
        center: `[[${slugify(center.name)}]]`,
        sessions_analyzed: 0,
        avg_score: 0,
        trend: "stable",
        updated_at: today,
      },
      body: `# Dr ${practitioner.fullName}

**Centre** : [[${slugify(center.name)}]]
**Rôle** : Audioprothésiste D.E.

## Synthèse

Audioprothésiste expérimentée du centre [[${slugify(center.name)}]]. Cette fiche s'enrichira automatiquement après chaque session analysée — patterns récurrents, forces, axes d'amélioration.

## Forces récurrentes

_À détecter au fil des sessions._

## Points d'amélioration

_À détecter au fil des sessions._

## Sessions récentes

_Aucune session analysée pour l'instant._
`,
    },
    {
      path: `patients/${slugify(durand.label)}.md`,
      kind: "patient",
      title: durand.label,
      metadata: {
        type: "patient",
        entity_id: durand.id,
        center: `[[${slugify(center.name)}]]`,
        updated_at: today,
      },
      body: `# ${durand.label}

**Âge** : ${durand.age ?? "—"} ans
**Statut** : ${durand.status}
**Centre** : [[${slugify(center.name)}]]
**Audioprothésiste suivi** : [[jonathan-goldminc]]

## Synthèse parcours

Patiente de démonstration — cas excellent. Score cible 88/100 sur la consultation de cadrage avec [[jonathan-goldminc]].

## Timeline

_Sera enrichie automatiquement à chaque session ou événement enregistré._
`,
    },
    {
      path: `patients/${slugify(martin.label)}.md`,
      kind: "patient",
      title: martin.label,
      metadata: {
        type: "patient",
        entity_id: martin.id,
        center: `[[${slugify(center.name)}]]`,
        updated_at: today,
      },
      body: `# ${martin.label}

**Âge** : ${martin.age ?? "—"} ans
**Statut** : ${martin.status}
**Centre** : [[${slugify(center.name)}]]
**Audioprothésiste suivi** : [[jonathan-goldminc]]

## Synthèse parcours

Patient de démonstration — cas moyen, montée en gamme ratée. Score cible 65/100 sur la consultation avec [[jonathan-goldminc]].

## Timeline

_Sera enrichie automatiquement à chaque session ou événement enregistré._
`,
    },
    {
      path: `patients/${slugify(lefevre.label)}.md`,
      kind: "patient",
      title: lefevre.label,
      metadata: {
        type: "patient",
        entity_id: lefevre.id,
        center: `[[${slugify(center.name)}]]`,
        updated_at: today,
      },
      body: `# ${lefevre.label}

**Âge** : ${lefevre.age ?? "—"} ans
**Statut** : ${lefevre.status}
**Centre** : [[${slugify(center.name)}]]
**Audioprothésiste suivi** : [[jonathan-goldminc]]

## Synthèse parcours

Patiente de démonstration — cas faible, [[objection-prix-non-traitee]]. Score cible 48/100 sur la consultation avec [[jonathan-goldminc]].

## Timeline

_Sera enrichie automatiquement à chaque session ou événement enregistré._
`,
    },
    {
      path: `patterns/objection-prix-non-traitee.md`,
      kind: "pattern",
      title: "Pattern — Objection prix non traitée",
      metadata: {
        type: "pattern",
        severity: "critical",
        first_detected: today.slice(0, 10),
        occurrences: 0,
        updated_at: today,
      },
      body: `# Objection prix non traitée

**Sévérité** : critique
**Étape framework** : 7 (Objections)

## Description

Quand un patient évoque le coût ("c'est cher", "je n'ai pas les moyens", "ma mutuelle ne couvre pas tout"), l'audioprothésiste élude l'objection en orientant directement vers la classe 1 (sans reste à charge) ou en clôturant la consultation. Cela coupe court à toute possibilité d'expliquer la valeur d'usage de la classe 2 et de proposer un essai comparatif.

## Impact économique

Sur le marché audio FR, le panier moyen classe 1 ≈ 950 €, classe 2 ≈ 1 800 €. Une objection prix non traitée coûte typiquement 400 à 800 € de panier moyen perdu, voire la consultation elle-même si le patient repart sans appareillage.

## Bonne pratique recommandée

1. Accueillir l'objection comme un signe d'intérêt ("Je comprends, c'est une décision importante.").
2. Reformuler le besoin réel exprimé en consultation (gêne dans le bruit, fatigue auditive, vie sociale).
3. Présenter la classe 2 comme une réponse à ce besoin spécifique, pas comme un produit plus cher.
4. Proposer un essai gratuit 30 jours pour faire vivre la différence.
5. Si l'objection persiste après l'essai, proposer un compromis classe 1 + accessoires connectés.

## Sessions où ce pattern a été détecté

_À enrichir automatiquement._
`,
    },
  ];

  for (const page of pages) {
    const md = serializeFrontmatter(page.metadata, page.body);
    await writeVaultFile(page.path, md);
    const backlinks = extractWikilinks(md);
    const entityId =
      typeof page.metadata.entity_id === "string" ? page.metadata.entity_id : null;
    await dbi
      .insert(vaultPages)
      .values({
        path: page.path,
        kind: page.kind,
        entityId,
        title: page.title,
        contentMd: md,
        metadata: page.metadata,
        backlinks,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: vaultPages.path,
        set: {
          kind: page.kind,
          entityId,
          title: page.title,
          contentMd: md,
          metadata: page.metadata,
          backlinks,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ ${page.path}`);
  }

  await client.end();
  console.log(`\n✓ Vault seedé : ${pages.length} fiches.`);
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
