import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consentAuditLog, patients } from "@/db/schema";

export type Patient = typeof patients.$inferSelect;

/**
 * Un patient a un consentement marketing actif si :
 * - consentAt est défini, ET
 * - revokedAt est null OU consentAt > revokedAt (reconsentement après révocation)
 */
export function hasActiveMarketingConsent(p: {
  marketingPsyConsentAt: Date | null;
  marketingPsyRevokedAt: Date | null;
}): boolean {
  if (!p.marketingPsyConsentAt) return false;
  if (!p.marketingPsyRevokedAt) return true;
  return (
    p.marketingPsyConsentAt.getTime() > p.marketingPsyRevokedAt.getTime()
  );
}

export async function grantMarketingConsent(opts: {
  patientId: string;
  actorId: string | null;
  source: "patient_page" | "admin" | "api";
}): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({ marketingPsyConsentAt: now, marketingPsyRevokedAt: null })
      .where(eq(patients.id, opts.patientId));
    await tx.insert(consentAuditLog).values({
      patientId: opts.patientId,
      action: "granted",
      scope: "marketing_psy",
      actorId: opts.actorId,
      source: opts.source,
    });
  });
}

export async function revokeMarketingConsent(opts: {
  patientId: string;
  actorId: string | null;
  source: "patient_page" | "admin" | "api";
}): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({ marketingPsyRevokedAt: now })
      .where(eq(patients.id, opts.patientId));
    await tx.insert(consentAuditLog).values({
      patientId: opts.patientId,
      action: "revoked",
      scope: "marketing_psy",
      actorId: opts.actorId,
      source: opts.source,
    });
  });
}
