import { config } from "dotenv";
import { google, drive_v3 } from "googleapis";
import { JWT } from "google-auth-library";

config({ path: ".env.local" });

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquant dans .env.local`);
  return value;
}

async function listAll(
  drive: drive_v3.Drive,
  parentId: string
): Promise<drive_v3.Schema$File[]> {
  const all: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime)",
      pageSize: 1000,
      pageToken,
    });
    all.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return all;
}

function classify(files: drive_v3.Schema$File[]) {
  const byExt = (ext: string) =>
    files.filter((f) => f.name?.toLowerCase().endsWith(ext)).length;
  const videos = files.filter(
    (f) =>
      f.name?.toLowerCase().endsWith(".mp4") ||
      f.mimeType?.startsWith("video/")
  ).length;
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME).length;
  return {
    total: files.length,
    folders,
    pdf: byExt(".pdf"),
    mp4: videos,
    docx: byExt(".docx"),
    key: byExt(".key"),
  };
}

async function main() {
  const clientEmail = getEnv("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = getEnv("GOOGLE_DRIVE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const rootId = getEnv("GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID");

  console.log(`→ Auth en tant que ${clientEmail}`);

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });

  console.log(`→ Lecture du dossier racine ${rootId}`);
  const rootMeta = await drive.files.get({
    fileId: rootId,
    fields: "id,name,mimeType",
  });
  console.log(`  Racine : "${rootMeta.data.name}"`);
  console.log();

  const rootChildren = await listAll(drive, rootId);
  const rootSummary = classify(rootChildren);
  console.log(
    `Niveau 0 : ${rootSummary.total} entrée(s) · ${rootSummary.folders} dossier(s) · ${rootSummary.pdf} PDF · ${rootSummary.mp4} vidéo(s) · ${rootSummary.docx} DOCX · ${rootSummary.key} .key`
  );
  console.log();

  const subFolders = rootChildren.filter((f) => f.mimeType === FOLDER_MIME);

  async function recursiveCount(
    parentId: string,
    depth: number,
    prefix: string
  ): Promise<{ pdf: number; mp4: number; docx: number; key: number; files: number }> {
    const children = await listAll(drive, parentId);
    const localFiles = children.filter((f) => f.mimeType !== FOLDER_MIME);
    const localFolders = children.filter((f) => f.mimeType === FOLDER_MIME);
    const sum = classify(localFiles);
    let agg = { pdf: sum.pdf, mp4: sum.mp4, docx: sum.docx, key: sum.key, files: localFiles.length };

    if (depth > 0) {
      for (const f of localFolders) {
        console.log(`${prefix}📁 ${f.name}`);
        const sub = await recursiveCount(f.id!, depth - 1, prefix + "   ");
        agg.pdf += sub.pdf;
        agg.mp4 += sub.mp4;
        agg.docx += sub.docx;
        agg.key += sub.key;
        agg.files += sub.files;
      }
      if (localFiles.length > 0) {
        localFiles.forEach((f) => {
          const marker = f.name?.toLowerCase().endsWith(".pdf")
            ? "📄"
            : f.name?.toLowerCase().endsWith(".mp4") || f.mimeType?.startsWith("video/")
            ? "🎬"
            : f.name?.toLowerCase().endsWith(".docx")
            ? "📝"
            : f.name?.toLowerCase().endsWith(".key")
            ? "🔑"
            : "📎";
          console.log(`${prefix}${marker} ${f.name}`);
        });
      }
    }
    return agg;
  }

  if (subFolders.length > 0) {
    console.log("Arbre complet (2 niveaux de profondeur) :");
    const grand = { pdf: 0, mp4: 0, docx: 0, key: 0, files: 0 };
    for (const folder of subFolders) {
      console.log(`\n📁 ${folder.name}`);
      const sub = await recursiveCount(folder.id!, 3, "   ");
      grand.pdf += sub.pdf;
      grand.mp4 += sub.mp4;
      grand.docx += sub.docx;
      grand.key += sub.key;
      grand.files += sub.files;
    }
    console.log();
    console.log("─────────────────────────────────");
    console.log(
      `Récap total : ${grand.files} fichiers · ${grand.pdf} PDF · ${grand.mp4} vidéos · ${grand.docx} DOCX · ${grand.key} .key (skip)`
    );
    console.log(
      `À ingérer J3 : ${grand.pdf + grand.mp4 + grand.docx} fichiers (PDF + vidéos + DOCX)`
    );
  }

  if (rootSummary.total - subFolders.length > 0) {
    console.log();
    console.log("Fichiers directs à la racine :");
    rootChildren
      .filter((f) => f.mimeType !== FOLDER_MIME)
      .forEach((f) =>
        console.log(`  - ${f.name}  (${f.mimeType})`)
      );
  }

  console.log();
  console.log("✓ Connexion Drive OK.");
}

main().catch((err: Error) => {
  console.error("\n✗ Échec :", err.message);
  if (/DECODER|ERR_OSSL|asn1|PEM/.test(err.message)) {
    console.error(
      "  → La private key est mal formée. Vérifie que tu as gardé les \\n littéraux et encadré par des guillemets doubles."
    );
  } else if (/File not found|notFound|404/.test(err.message)) {
    console.error(
      "  → Le dossier n'est pas accessible. Le Service Account a-t-il été ajouté au partage (Lecteur) ?"
    );
  } else if (/invalid_grant|invalid_client|unauthorized_client/.test(err.message)) {
    console.error(
      "  → Problème d'auth : vérifie que l'API Drive est bien activée dans le projet GCP."
    );
  }
  process.exit(1);
});
