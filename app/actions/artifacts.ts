"use server";

import { after } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import type { ArtifactType } from "@/lib/artifacts/generate";

const VALID_TYPES: ArtifactType[] = [
  "clinical_notes",
  "patient_email",
  "patient_sms",
  "orl_letter",
];

export async function regenerateArtifact(
  sessionId: string,
  type: ArtifactType
): Promise<{ ok: true }> {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Type d'artefact invalide : ${type}`);
  }
  kickArtifact(sessionId, type);
  return { ok: true };
}

export async function regenerateAllArtifacts(sessionId: string): Promise<{ ok: true }> {
  kickArtifact(sessionId, null);
  return { ok: true };
}

function kickArtifact(sessionId: string, type: ArtifactType | null): void {
  after(async () => {
    try {
      const res = await fetch(`${getSiteUrl()}/api/sessions/${sessionId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type ? { type } : {}),
      });
      if (!res.ok) {
        console.warn(
          `artifact kick non-OK (${type ?? "all"}) for ${sessionId}: ${res.status}`
        );
      }
    } catch (err) {
      console.warn(`artifact kick failed (${type ?? "all"}) for ${sessionId}`, err);
    }
  });
}
