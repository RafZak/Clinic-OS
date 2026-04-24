"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  MessageSquare,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreRadar, type RadarPoint } from "@/components/results/score-radar";
import { cn } from "@/lib/utils";
import { formatEur, formatTimestampMs } from "@/lib/format";
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
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Transcription ({lines.length} lignes)
          </h3>
          <div className="mt-4 flex max-h-[600px] flex-col gap-2 overflow-y-auto pr-2">
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune transcription disponible.</p>
            )}
            {lines.map((l) => (
              <div key={l.id} className="flex gap-3 text-sm">
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
                  {l.speaker === "practitioner" ? "Pro" : "Patient"}
                </span>
                <span className="flex-1 text-ink leading-relaxed">{l.text}</span>
              </div>
            ))}
          </div>
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
        <PlaceholderPanel
          icon={<FileText className="size-5 text-muted-foreground" aria-hidden />}
          title="Livrables post-consultation (J8)"
          description="Notes cliniques, email patient, SMS patient et courrier ORL seront générés ici à partir de la même analyse. Prévu pour la deuxième moitié du chantier (J8)."
        />
      </TabsContent>

      <TabsContent value="memory">
        <PlaceholderPanel
          icon={<NotebookPen className="size-5 text-muted-foreground" aria-hidden />}
          title="Mémoire organisationnelle (J8)"
          description="Cette session nourrira la fiche Karpathy de l'audioprothésiste à partir de J8. Le lien vers la fiche mise à jour apparaîtra ici."
        />
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
            {insight.estimatedImpactEur ? (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                {formatEur(insight.estimatedImpactEur)}
              </span>
            ) : null}
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
      <ul className="mt-1 flex flex-col gap-1.5">
        {citations.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-xs">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              <span className="text-ink">{c.sourceFile}</span>
              {c.moduleNumber !== null && ` · module ${c.moduleNumber}`}
              {` · similarité ${(c.similarity * 100).toFixed(0)}%`}
              <span className="mt-0.5 block italic text-ink/70">{c.excerpt}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlaceholderPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted px-6 py-10 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-surface">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-medium text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

