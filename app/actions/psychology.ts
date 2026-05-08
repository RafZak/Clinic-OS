"use server";

import { revalidatePath } from "next/cache";
import {
  grantMarketingConsent,
  revokeMarketingConsent,
} from "@/lib/psychology/consent";

// Best-effort: returns null if no auth identity available.
async function getActorId(): Promise<string | null> {
  // TODO: brancher sur l'auth réelle quand elle sera en place
  // Pour le MVP avec toggle de rôle factice, on accepte actor null (audit log autorisé)
  return null;
}

export async function grantConsentAction(patientId: string) {
  const actorId = await getActorId();
  await grantMarketingConsent({ patientId, actorId, source: "patient_page" });
  revalidatePath(`/patients/${patientId}`);
}

export async function revokeConsentAction(patientId: string) {
  const actorId = await getActorId();
  await revokeMarketingConsent({ patientId, actorId, source: "patient_page" });
  revalidatePath(`/patients/${patientId}`);
}
