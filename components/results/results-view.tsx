"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  MessageSquare,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreRadar, type RadarPoint } from "@/components/results/score-radar";
import { ArtifactsPanel } from "@/components/results/artifacts-panel";
import { cn } from "@/lib/utils";
import { formatTimestampMs } from "@/lib/format";
import type { ResultsBundle, InsightCitation } from "@/lib/types/analysis";

type Bundle = ResultsBundle;

const INSIGHT_TYPE_LABEL: Record<string, string> = {
  missed_objection: "Objection non traitée",
  upsell_missed: "Montée en gamme manquée",
  good_practice: "Bonne pratique",
  improvement: "Axe d'amélioration",
};

const INSIGHT_ICON: Record<string, typeof AlertTriangle> = {
  missed_objection: AlertTriangle,
  upsell_missed: ArrowUpRight,
  good_practice: CheckCircle2,
  improvement: Sparkles,
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function ResultsView({ bundle }: { bundle: Bundle }) {
  const { session, lines, scores, insights } = bundle;
  const isPhoneCall = session.kind === "phone_call";
  const proLabel = isPhoneCall ? "Standardiste" : "Pro";
  const patientLabel = isPhoneCall ? "Appelant" : "Patient";

  const radarPoints: RadarPoint[] = useMemo(
    () =>
      scores.map((s) => ({
        step: s.stepNumber,
        label: s.stepName,
        score: s.score,
        rationale: s.rationale,
      })),
    [scores]
  );

  const sortedInsights = useMemo(
    () =>
      [...insights].sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity ?? "info"] ?? 3) -
          (SEVERITY_ORDER[b.severity ?? "info"] ?? 3)
      ),
    [insights]
  );

  const topInsights = sortedInsights.slice(0, 4);

  const annotations = useMemo(() => {
    const byLineId = new Map<string, Bundle["insights"][number][]>();
    const unattached: Bundle["insights"][number][] = [];
    if (lines.length === 0) {
      return { byLineId, unattached: insights };
    }
    for (const i of insights) {
      if (i.timestampMs == null) {
        unattached.push(i);
        continue;
      }
      const ts = i.timestampMs;
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const l of lines) {
        if (l.startMs <= ts && ts < l.endMs) {
          bestId = l.id;
          bestDist = 0;
          break;
        }
        const dist = Math.min(Math.abs(ts - l.startMs), Math.abs(ts - l.endMs));
        if (dist < bestDist) {
          bestId = l.id;
          bestDist = dist;
        }
      }
      if (bestId && bestDist < 30_000) {
        const arr = byLineId.get(bestId) ?? [];
        arr.push(i);
        byLineId.set(bestId, arr);
      } else {
        unattached.push(i);
      }
    }
    return { byLineId, unattached };
  }, [lines, insights]);

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="flex w-full justify-start gap-1 bg-surface-muted">
        <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
        <TabsTrigger value="transcript">Transcription</TabsTrigger>
        <TabsTrigger value="coaching">Coaching ({insights.length})</TabsTrigger>
        <TabsTrigger value="artifacts">Livrables</TabsTrigger>
        <TabsTrigger value="memory">Mémoire</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-surface px-5 py-5 lg:col-span-3">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Scoring par étape
            </h3>
            <ScoreRadar points={radarPoints} />
            {session.summary && (
              <p className="mt-4 rounded-md bg-light/40 px-4 py-3 text-sm text-ink leading-relaxed">
                {session.summary}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:col-span-2">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Insights majeurs
            </h3>
            {topInsights.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun insight détecté.</p>
            )}
            {topInsights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="transcript">
        <div className="rounded-lg border border-border bg-surface px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Transcription ({lines.length} lignes)
            </h3>
            {insights.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {insights.length} annotation{insights.length > 1 ? "s" : ""} IA en marge
              </span>
            )}
          </div>
          <div className="mt-4 flex max-h-[600px] flex-col gap-3 overflow-y-auto pr-2">
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune transcription disponible.</p>
            )}
            {lines.map((l) => {
              const lineAnnotations = annotations.byLineId.get(l.id) ?? [];
              return (
                <div key={l.id} className="grid grid-cols-12 gap-3 text-sm">
                  <div className="col-span-12 flex gap-3 lg:col-span-8">
                    <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                      {formatTimestampMs(l.startMs)}
                    </span>
                    <span
                      className={cn(
                        "w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] uppercase tracking-wide",
                        l.speaker === "practitioner"
                          ? "bg-brand/10 text-brand"
                          : "bg-surface-muted text-muted-foreground"
                      )}
                    >
                      {l.speaker === "practitioner" ? proLabel : patientLabel}
                    </span>
                    <span className="flex-1 text-ink leading-relaxed">{l.text}</span>
                  </div>
                  <div className="col-span-12 flex flex-col gap-1.5 lg:col-span-4">
                    {lineAnnotations.map((a) => (
                      <InlineAnnotation key={a.id} insight={a} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {annotations.unattached.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Annotations générales (non rattachées à un moment précis)
              </h4>
              <div className="mt-2 flex flex-col gap-1.5">
                {annotations.unattached.map((a) => (
                  <InlineAnnotation key={a.id} insight={a} />
                ))}
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="coaching">
        <div className="flex flex-col gap-3">
          {sortedInsights.length === 0 && (
            <p className="rounded-lg border border-border bg-surface px-5 py-8 text-center text-sm text-muted-foreground">
              Aucun insight détecté.
            </p>
          )}
          {sortedInsights.map((i) => (
            <InsightCard key={i.id} insight={i} detailed />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="artifacts">
        <ArtifactsPanel
          sessionId={session.id}
          artifacts={bundle.artifacts}
          analysisDone={session.analysisStatus === "done"}
        />
      </TabsContent>

      <TabsContent value="memory">
        <MemoryPanel bundle={bundle} />
      </TabsContent>
    </Tabs>
  );
}

function InsightCard({
  insight,
  detailed,
}: {
  insight: Bundle["insights"][number];
  detailed?: boolean;
}) {
  const Icon = INSIGHT_ICON[insight.type] ?? Sparkles;
  const typeLabel = INSIGHT_TYPE_LABEL[insight.type] ?? insight.type;
  const severityClass =
    insight.severity === "critical"
      ? "border-destructive/40 bg-destructive/5"
      : insight.severity === "warning"
        ? "border-amber-400/40 bg-amber-400/5"
        : "border-border bg-surface";

  return (
    <div className={cn("rounded-lg border px-4 py-3", severityClass)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {typeLabel}
            </span>
            {insight.relatedStep && (
              <span className="text-[10px] text-muted-foreground">
                · Étape {insight.relatedStep}
              </span>
            )}
          </div>
          <h4 className="mt-1 text-sm font-semibold text-ink">{insight.title}</h4>
          <p
            className={cn(
              "mt-1 text-sm text-ink/80 leading-relaxed",
              !detailed && "line-clamp-3"
            )}
          >
            {insight.description}
          </p>
          {detailed && insight.citationChunks && insight.citationChunks.length > 0 && (
            <Citations citations={insight.citationChunks} />
          )}
        </div>
      </div>
    </div>
  );
}

function Citations({ citations }: { citations: InsightCitation[] }) {
  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Sources formation
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {citations.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-xs">
            <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-muted-foreground">
              <span className="text-ink">{c.sourceFile}</span>
              {c.moduleNumber !== null && ` · module ${c.moduleNumber}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineAnnotation({
  insight,
}: {
  insight: Bundle["insights"][number];
}) {
  const Icon = INSIGHT_ICON[insight.type] ?? Sparkles;
  const typeLabel = INSIGHT_TYPE_LABEL[insight.type] ?? insight.type;
  const tone =
    insight.severity === "critical"
      ? "border-brand/60 bg-brand/5 text-brand"
      : insight.severity === "warning"
        ? "border-amber-400/50 bg-amber-50 text-amber-800"
        : "border-border bg-surface-muted text-muted-foreground";

  return (
    <div className={cn("rounded-md border px-2.5 py-1.5 text-[11px]", tone)}>
      <div className="flex items-start gap-1.5">
        <Icon className="mt-0.5 size-3 shrink-0" aria-hidden />
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wide opacity-80">{typeLabel}</span>
          <span className="font-medium leading-tight text-ink">{insight.title}</span>
          <span className="text-[11px] leading-snug text-ink/75">{insight.description}</span>
        </div>
      </div>
    </div>
  );
}

function MemoryPanel({ bundle }: { bundle: Bundle }) {
  const recentlyUpdated = (link: { updatedAt: Date | null } | null) => {
    if (!link?.updatedAt) return false;
    const ageMs = Date.now() - new Date(link.updatedAt).getTime();
    return ageMs < 5 * 60 * 1000;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface px-5 py-4">
        <div className="flex items-start gap-3">
          <NotebookPen className="mt-0.5 size-5 text-brand" aria-hidden />
          <div>
            <h3 className="text-sm font-medium text-ink">Mémoire</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cette session a enrichi automatiquement la mémoire — patterns détectés,
              forces, axes d&apos;amélioration. Le réseau apprend collectivement.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <VaultLinkCard
          title="Fiche audioprothésiste"
          description="Synthèse, forces récurrentes, axes d'amélioration et sessions récentes."
          link={bundle.practitionerVault}
          recent={recentlyUpdated(bundle.practitionerVault)}
        />
        <VaultLinkCard
          title="Fiche session"
          description="Snapshot complet de cette consultation, traçable et auditable."
          link={bundle.sessionVault}
          recent={recentlyUpdated(bundle.sessionVault)}
        />
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface-muted px-5 py-3 text-xs text-muted-foreground">
        Toute la mémoire est consultable dans <a href="/admin/vault" className="text-brand hover:underline">la section Mémoire</a>{" "}
        — vue graph et export complet pour audit.
      </div>
    </div>
  );
}

function VaultLinkCard({
  title,
  description,
  link,
  recent,
}: {
  title: string;
  description: string;
  link: { path: string; title: string; updatedAt: Date | null } | null;
  recent: boolean;
}) {
  if (!link) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-4">
        <h4 className="text-sm font-medium text-ink">{title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <p className="mt-3 text-xs italic text-muted-foreground">
          Génération en cours — la fiche sera créée quelques secondes après l&apos;analyse.
        </p>
      </div>
    );
  }
  const href = `/admin/vault/${link.path.replace(/\.md$/, "")}`;
  return (
    <a
      href={href}
      className="group rounded-lg border border-border bg-surface px-4 py-4 transition hover:border-brand/40 hover:bg-brand/5"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {recent && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
            Mis à jour à l&apos;instant
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <p className="mt-3 truncate text-xs font-mono text-brand group-hover:underline">
        {link.path}
      </p>
    </a>
  );
}

