import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { asc } from "drizzle-orm";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import { DeletePatientButton } from "@/components/patients/delete-patient-button";
import { PatientTabs } from "@/components/patients/patient-tabs";
import { PatientInsightsView } from "@/components/patients/patient-insights-view";
import { RelationshipAbstractView } from "@/components/patients/relationship-abstract-view";
import { VaultMarkdown } from "@/components/admin/vault-markdown";
import { MarketingConsentToggle } from "@/components/patients/marketing-consent-toggle";
import { db } from "@/db/client";
import { vaultPages } from "@/db/schema";
import {
  getPatientDetail,
  patientSlug,
  STATUS_LABEL,
  STATUS_LABEL_EN,
  type PatientStatus,
} from "@/lib/patients";
import { getPatientSnapshots } from "@/lib/psychology/queries";
import { computeGlobalRadar } from "@/lib/psychology/aggregate";
import {
  CARE_DIMENSIONS,
  mapRadarToCare,
} from "@/lib/care-insights/dimensions";
import { getRelationshipSynthesis } from "@/lib/relationship/queries";
import type { RelationshipSynthesis } from "@/lib/relationship/types";
import { getVaultPageByPath } from "@/lib/vault/ingest";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<PatientStatus, string> = {
  prospect: "bg-surface-muted text-foreground border-border",
  patient: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(date: Date | null, locale: string): string {
  if (!date) return "—";
  return date.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getPatientDetail(id);
  if (!detail) notFound();
  const { patient, events } = detail;

  const t = await getTranslations("patients");
  const locale = await getLocale();
  const statusMap = locale === "en" ? STATUS_LABEL_EN : STATUS_LABEL;

  const vaultPath = `patients/${patientSlug(patient.label)}.md`;
  const [vaultPage, allPages] = await Promise.all([
    getVaultPageByPath(vaultPath),
    db
      .select({ path: vaultPages.path, title: vaultPages.title })
      .from(vaultPages)
      .orderBy(asc(vaultPages.path)),
  ]);

  const pageIndex = allPages.map((p) => ({
    slug: p.path.replace(/^.*\//, "").replace(/\.md$/, ""),
    path: p.path,
    title: p.title,
  }));

  const psySnapshots = await getPatientSnapshots(patient.id);
  const globalRadar = computeGlobalRadar(psySnapshots);
  const hasAnyScore = Object.values(globalRadar).some((v) => v !== null);
  const care = mapRadarToCare(globalRadar);
  const careDims = CARE_DIMENSIONS.map((key) => ({ key, score: care[key] }));

  // La table patient_relationship_synthesis est additive : tant qu'elle n'est
  // pas appliquée en base, on dégrade proprement (onglets vides) sans planter.
  let synthesis: RelationshipSynthesis | null = null;
  try {
    synthesis = await getRelationshipSynthesis(patient.id);
  } catch {
    synthesis = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={patient.label}
        description={[
          patient.age != null ? t("ageYears", { age: patient.age }) : null,
          patient.centerName ? t("centerSuffix", { name: patient.centerName }) : null,
          patient.firstContactAt
            ? t("firstContactPrefix", { date: formatDate(patient.firstContactAt, locale) })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <MarketingConsentToggle
              patientId={patient.id}
              consentAt={patient.marketingPsyConsentAt}
              revokedAt={patient.marketingPsyRevokedAt}
            />
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                STATUS_BADGE_CLASS[patient.status]
              )}
            >
              {statusMap[patient.status]}
            </span>
            <DeletePatientButton patientId={patient.id} />
            <Link href="/patients">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {t("backToList")}
              </Button>
            </Link>
          </div>
        }
      />

      <PatientTabs
        journey={
          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {t("timelineHeader", { count: events.length })}
            </h2>
            <PatientTimeline events={events} />
          </div>
        }
        insights={
          hasAnyScore || synthesis ? (
            <PatientInsightsView
              dimensions={careDims}
              communicationStyle={
                synthesis?.communicationStyle ?? { lead: null, relevant: [] }
              }
              setbacks={synthesis?.setbacks ?? { present: [] }}
              priorities={
                synthesis?.priorities ?? { lead: null, relevant: [] }
              }
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted-foreground">
              {t("noSessions")}
            </p>
          )
        }
        abstract={
          <RelationshipAbstractView
            abstractMd={synthesis?.abstractMd ?? ""}
            updatedAt={synthesis?.updatedAt ?? null}
          />
        }
        detail={
          vaultPage ? (
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="mb-4 flex items-center justify-end">
                <Link
                  href={`/admin/vault/${vaultPath.replace(/\.md$/, "")}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {t("openFullCard")}
                </Link>
              </div>
              <VaultMarkdown raw={vaultPage.contentMd} pageIndex={pageIndex} />
              {vaultPage.updatedAt && (
                <p className="mt-6 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  {t("memoryUpdatedAt", {
                    date: vaultPage.updatedAt.toLocaleString(
                      locale === "en" ? "en-GB" : "fr-FR",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    ),
                  })}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted-foreground">
              {t("noVaultYet")}
            </div>
          )
        }
      />
    </div>
  );
}
