import { NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/db/client";
import { vaultPages } from "@/db/schema";
import { asc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const rows = await db
    .select({
      path: vaultPages.path,
      contentMd: vaultPages.contentMd,
    })
    .from(vaultPages)
    .orderBy(asc(vaultPages.path));

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Vault vide. Lancez pnpm seed:vault." },
      { status: 404 }
    );
  }

  const zip = new JSZip();
  for (const r of rows) {
    zip.file(r.path, r.contentMd);
  }
  // README explicatif au top du zip
  zip.file(
    "_README.md",
    `# Mémoire du réseau Clinic OS — Export Obsidian

Cette archive contient l'intégralité de la mémoire vivante du réseau au format markdown.

## Pour ouvrir dans Obsidian

1. Décompressez l'archive dans un dossier.
2. Ouvrez Obsidian → \`Open folder as vault\` → sélectionnez le dossier.
3. Les wikilinks \`[[…]]\` fonctionnent nativement, le graph view aussi.

## Structure

- \`practitioners/\` : fiches par audioprothésiste
- \`assistants/\` : fiches assistants accueil
- \`centers/\` : fiches par centre
- \`patients/\` : fiches par patient suivi
- \`patterns/\` : patterns récurrents détectés
- \`sessions/\` : 1 fiche par session analysée

## Argument démo

Cet export prouve que toutes les données IA sont auditables, exportables, portables. Pas de boîte noire — chaque insight, chaque décision, chaque pattern est consultable, modifiable, partageable.

Généré le ${new Date().toISOString()}.
`
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `clinic-os-vault-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(new Uint8Array(buffer).buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
