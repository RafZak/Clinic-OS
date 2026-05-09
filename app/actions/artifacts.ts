"use server";

import { after } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import { INTERNAL_SECRET_HEADER } from "@/lib/auth-shared";
import type { ArtifactType } from "@/lib/artifacts/generate";

const VALID_TYPES: ArtifactType[] = [
  "clinical_notes",
  "patient_email",
  "patient_sms",
  "orl_letter",
];

export type RegenerateOptions = {
  usePsyProfile?: boolean;
};

export async function regenerateArtifact(
  sessionId: string,
  type: ArtifactType,
  options: RegenerateOptions = {}
): Promise<{ ok: true }> {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Type d'artefact invalide : ${type}`);
  }
  kickArtifact(sessionId, type, options);
  return { ok: true };
}

export async function regenerateAllArtifacts(sessionId: string): Promise<{ ok: true }> {
  kickArtifact(sessionId, null, {});
  return { ok: true };
}

function kickArtifact(
  sessionId: string,
  type: ArtifactType | null,
  options: RegenerateOptions
): void {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.warn(
      `INTERNAL_API_SECRET manquant — artifact kick impossible pour ${sessionId}`
    );
    return;
  }
  after(async () => {
    try {
      const payload: Record<string, unknown> = {};
      if (type) payload.type = type;
      if (options.usePsyProfile) payload.usePsyProfile = true;
      const res = await fetch(`${getSiteUrl()}/api/sessions/${sessionId}/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_SECRET_HEADER]: secret,
        },
        body: JSON.stringify(payload),
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
