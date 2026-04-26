import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import { MemoryView } from "@/components/patients/memory-view";
import { DeletePatientButton } from "@/components/patients/delete-patient-button";
import { db } from "@/db/client";
import { vaultPages } from "@/db/schema";
import {
  getPatientDetail,
  patientSlug,
  STATUS_LABEL,
  type PatientStatus,
} from "@/lib/patients";
import { getVaultPageByPath } from "@/lib/vault/ingest";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_BADGE_CLASS: Record<PatientStatus, string> = {
  prospect: "bg-surface-muted text-foreground border-border",
  patient: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", {
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
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={patient.label}
        description={[
          patient.age != null ? `${patient.age} ans` : null,
          patient.centerName ? `Centre ${patient.centerName}` : null,
          patient.firstContactAt
            ? `Premier contact : ${formatDate(patient.firstContactAt)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                STATUS_BADGE_CLASS[patient.status]
              )}
            >
              {STATUS_LABEL[patient.status]}
            </span>
            <DeletePatientButton patientId={patient.id} />
            <Link href="/patients">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Liste
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Parcours patient ({events.length} événements)
          </h2>
          <PatientTimeline events={events} />
        </section>

        <aside className="lg:col-span-5">
          <div className="sticky top-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Mémoire
              </h2>
              {vaultPage && (
                <Link
                  href={`/admin/vault/${vaultPath.replace(/\.md$/, "")}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Ouvrir la fiche complète
                </Link>
              )}
            </div>
            {vaultPage ? (
              <div className="flex flex-col gap-3">
                <MemoryView
                  raw={vaultPage.contentMd}
                  pageIndex={pageIndex}
                />
                {vaultPage.updatedAt && (
                  <p className="px-1 text-xs text-muted-foreground">
                    Fiche mise à jour le{" "}
                    {vaultPage.updatedAt.toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted-foreground">
                Pas de fiche en mémoire encore. Une session analysée pour ce patient
                en générera une automatiquement.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
