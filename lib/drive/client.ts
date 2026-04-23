import { drive_v3, google } from "googleapis";
import { JWT } from "google-auth-library";

export function getDriveClient(): drive_v3.Drive {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google Drive credentials manquantes (GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY)"
    );
  }

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

export function getKnowledgeFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID manquant");
  return id;
}
