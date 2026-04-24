import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FRAMEWORK_LABEL, type FrameworkKind } from "@/lib/frameworks";
import type { SessionRow } from "@/lib/sessions";

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function ResultsShell({ session }: { session: SessionRow }) {
  const kind = (session.kind as FrameworkKind) ?? "consultation";
  const backHref = kind === "consultation" ? "/consultations" : "/appels";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </Link>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          Session terminée
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface px-6 py-6">
        <h1 className="text-2xl font-semibold text-ink">
          Résultats — {FRAMEWORK_LABEL[kind]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Session <span className="font-mono">{session.id.slice(0, 8)}…</span> ·
          durée {formatDuration(session.durationSeconds)}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-light/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Score global</p>
            <p className="mt-1 text-2xl font-semibold text-ink">—</p>
          </div>
          <div className="rounded-md border border-border bg-light/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Insights détectés</p>
            <p className="mt-1 text-2xl font-semibold text-ink">—</p>
          </div>
          <div className="rounded-md border border-border bg-light/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Impact estimé</p>
            <p className="mt-1 text-2xl font-semibold text-ink">—</p>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted-foreground">
          L&apos;analyseur IA (scoring par étape, insights chiffrés €, 4 artefacts) sera livré en J6-J8.
          L&apos;audio et la transcription sont déjà en base pour cette session.
        </div>
      </div>
    </div>
  );
}
