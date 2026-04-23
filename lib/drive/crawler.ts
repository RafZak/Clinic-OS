import { drive_v3 } from "googleapis";

const FOLDER_MIME = "application/vnd.google-apps.folder";

const SKIPPED_EXTENSIONS = [".key", ".ds_store", ".mov.hidden"];
const SKIPPED_FILE_PREFIXES = ["._"]; // macOS resource-fork forks

/** Sous-dossier "affiches" ignoré par décision produit (Q3). */
const SKIPPED_FOLDER_NAMES = new Set(["SBL_Reference_module_4_livret_2"]);

const PROGRAM_SLUG_MAP: Record<string, string> = {
  Reference: "reference",
  "Personnel accueil": "personnel-accueil",
  "Convaincre au téléphone": "convaincre-telephone",
  "Audio Vente": "audio-vente",
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  modifiedTime: string;
  programSlug: string;
  moduleNumber?: number;
  driveFolderPath: string;
};

export type FileKind = "pdf" | "docx" | "video" | "unknown";

export function classifyFile(file: DriveFile): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".mp4") || file.mimeType.startsWith("video/")) return "video";
  return "unknown";
}

/** Parse "module N" / "Module N" / "#N" / "[Module N]" in filenames. */
export function parseModuleNumber(filename: string): number | undefined {
  const patterns = [
    /_[mM]odule[_\s]+(\d+)/, // SBL_..._module_7 or _Module_7
    /\[\s*[Mm]odule\s+(\d+)\s*\]/, // [Module 7]
    /#(\d+)(?:bis)?/, // #4 or #3bis
    /\bModule\s+(\d+)\b/, // Module 10
  ];
  for (const re of patterns) {
    const m = filename.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

function shouldSkipFile(f: drive_v3.Schema$File): boolean {
  const n = (f.name ?? "").toLowerCase();
  if (SKIPPED_EXTENSIONS.some((ext) => n.endsWith(ext))) return true;
  if (SKIPPED_FILE_PREFIXES.some((p) => (f.name ?? "").startsWith(p))) return true;
  if (n === ".ds_store") return true;
  return false;
}

async function listChildren(
  drive: drive_v3.Drive,
  parentId: string
): Promise<drive_v3.Schema$File[]> {
  const all: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      fields:
        "nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)",
      pageSize: 1000,
      pageToken,
    });
    all.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return all;
}

async function* walk(
  drive: drive_v3.Drive,
  folderId: string,
  programSlug: string,
  pathBreadcrumb: string
): AsyncGenerator<DriveFile> {
  const children = await listChildren(drive, folderId);
  for (const child of children) {
    if (child.mimeType === FOLDER_MIME) {
      if (SKIPPED_FOLDER_NAMES.has(child.name ?? "")) {
        console.warn(`  ⊘ skip sous-dossier (affiches) : ${child.name}`);
        continue;
      }
      yield* walk(
        drive,
        child.id!,
        programSlug,
        `${pathBreadcrumb}/${child.name ?? ""}`
      );
    } else if (!shouldSkipFile(child)) {
      yield {
        id: child.id!,
        name: child.name!,
        mimeType: child.mimeType!,
        sizeBytes: child.size ? parseInt(child.size, 10) : undefined,
        modifiedTime: child.modifiedTime!,
        programSlug,
        moduleNumber: parseModuleNumber(child.name!),
        driveFolderPath: pathBreadcrumb,
      };
    }
  }
}

export async function collectFiles(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<DriveFile[]> {
  const programFolders = await listChildren(drive, rootFolderId);
  const out: DriveFile[] = [];

  for (const program of programFolders) {
    if (program.mimeType !== FOLDER_MIME) continue;
    const normalizedName = (program.name ?? "").normalize("NFC");
    const slug = PROGRAM_SLUG_MAP[normalizedName];
    if (!slug) {
      console.warn(
        `  ⊘ programme inconnu (slug absent du mapping) : "${program.name}"`
      );
      continue;
    }
    for await (const file of walk(drive, program.id!, slug, normalizedName)) {
      out.push(file);
    }
  }

  return out;
}

/** Dédup vidéos par (name, sizeBytes). Conserve la 1re occurrence. */
export function dedupeVideos(files: DriveFile[]): DriveFile[] {
  const seen = new Set<string>();
  const out: DriveFile[] = [];
  for (const f of files) {
    if (classifyFile(f) !== "video") {
      out.push(f);
      continue;
    }
    const key = `${f.name}|${f.sizeBytes ?? 0}`;
    if (seen.has(key)) {
      console.warn(
        `  ⊘ doublon vidéo ignoré : ${f.name} (${f.sizeBytes ?? "?"} o)`
      );
      continue;
    }
    seen.add(key);
    out.push(f);
  }
  return out;
}
