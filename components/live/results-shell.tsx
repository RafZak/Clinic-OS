import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FRAMEWORK_LABEL, type FrameworkKind } from "@/lib/frameworks";
import { loadResultsBundle } from "@/lib/results";
import { formatDuration, scoreTone, type ScoreTone } from "@/lib/format";
import type { SessionRow } from "@/lib/sessions";
import { parsePhoneTags, type SessionMetadata } from "@/lib/phone-tags";
import { AnalysisLoading } from "@/components/results/analysis-loading";
import { AnalysisFailed } from "@/components/results/analysis-failed";
import { ResultsView } from "@/components/results/results-view";
import { PhoneTagsPanel } from "@/components/results/phone-tags-panel";

type AnalysisStatus =
  | "pending"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "done"
  | "failed";

export async function ResultsShell({ session }: { session: SessionRow }) {
  const kind = (session.kind as FrameworkKind) ?? "consultation";
  const bundle = await loadResultsBundle(session.id);
  if (!bundle) return null;

  const status = (bundle.session.analysisStatus ?? "pending") as AnalysisStatus;
  const globalScore = bundle.session.globalScore;
  const phoneTags =
    kind === "phone_call"
      ? parsePhoneTags(
          (bundle.session.metadata as SessionMetadata | null)?.tags
        )
      : null;
  const backHref = bundle.patient ? `/patients/${bundle.patient.id}` : "/";
  const backLabel = bundle.patient ? "Parcours patient" : "Tableau de bord";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          {statusLabel(status)}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              {bundle.patient?.label ?? `Session ${bundle.session.id.slice(0, 8)}…`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {FRAMEWORK_LABEL[kind]} · durée {formatDuration(bundle.session.durationSeconds)}
            </p>
          </div>
          {status === "done" && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                label="Score global"
                value={globalScore !== null ? `${globalScore}/100` : "—"}
                tone={globalScore !== null ? scoreTone(globalScore) : "default"}
              />
              <Badge label="Insights" value={String(bundle.insights.length)} />
            </div>
          )}
        </div>
      </div>

      {status === "done" && phoneTags && <PhoneTagsPanel tags={phoneTags} />}

      {status === "failed" ? (
        <AnalysisFailed sessionId={bundle.session.id} error={bundle.session.analysisError} />
      ) : status !== "done" ? (
        <AnalysisLoading sessionId={bundle.session.id} initialStatus={status} />
      ) : (
        <ResultsView bundle={bundle} />
      )}
    </div>
  );
}

function Badge({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand" | ScoreTone;
}) {
  const styles = badgeStyles(tone);
  return (
    <div className={`rounded-md border px-4 py-2 ${styles.frame}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold ${styles.value}`}>{value}</p>
    </div>
  );
}

function badgeStyles(tone: "default" | "brand" | ScoreTone): {
  frame: string;
  value: string;
} {
  switch (tone) {
    case "brand":
      return { frame: "border-brand/30 bg-brand/5", value: "text-brand" };
    case "good":
      return {
        frame: "border-emerald-300 bg-emerald-50",
        value: "text-emerald-700",
      };
    case "warn":
      return {
        frame: "border-amber-300 bg-amber-50",
        value: "text-amber-700",
      };
    case "bad":
      return { frame: "border-red-300 bg-red-50", value: "text-red-700" };
    case "neutral":
    case "default":
    default:
      return { frame: "border-border bg-light/40", value: "text-ink" };
  }
}

function statusLabel(status: AnalysisStatus): string {
  switch (status) {
    case "pending":
      return "Analyse en attente";
    case "transcribing":
      return "Re-transcription";
    case "transcribed":
      return "Transcription prête";
    case "analyzing":
      return "Analyse IA";
    case "done":
      return "Session analysée";
    case "failed":
      return "Analyse échouée";
  }
}
