"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  MessageSquare,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreRadar, type RadarPoint } from "@/components/results/score-radar";
import { ArtifactsPanel } from "@/components/results/artifacts-panel";
import { cn } from "@/lib/utils";
import { formatTimestampMs } from "@/lib/format";
import {
  getScorableFramework,
  getStepName,
  type FrameworkKind,
} from "@/lib/frameworks";
import type { Locale } from "@/lib/locale";
import type { ResultsBundle, InsightCitation } from "@/lib/types/analysis";

type Bundle = ResultsBundle;

const INSIGHT_ICON: Record<string, typeof AlertTriangle> = {
  missed_objection: AlertTriangle,
  upsell_missed: ArrowUpRight,
  good_practice: CheckCircle2,
  improvement: Sparkles,
};

type Tone = {
  card: string;
  inline: string;
  icon: string;
};

const INSIGHT_TONE: Record<string, Tone> = {
  missed_objection: {
    card: "border-red-300 bg-red-50/60",
    inline: "border-red-300 bg-red-50/70",
    icon: "text-red-600",
  },
  upsell_missed: {
    card: "border-red-300 bg-red-50/60",
    inline: "border-red-300 bg-red-50/70",
    icon: "text-red-600",
  },
  improvement: {
    card: "border-amber-300 bg-amber-50/60",
    inline: "border-amber-300 bg-amber-50/70",
    icon: "text-amber-600",
  },
  good_practice: {
    card: "border-emerald-300 bg-emerald-50/60",
    inline: "border-emerald-300 bg-emerald-50/70",
    icon: "text-emerald-600",
  },
};

const NEUTRAL_TONE: Tone = {
  card: "border-border bg-surface",
  inline: "border-border bg-surface-muted",
  icon: "text-muted-foreground",
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function ResultsView({ bundle }: { bundle: Bundle }) {
  const t = useTranslations("results");
  const locale = useLocale() as Locale;
  const { session, lines, scores, insights } = bundle;
  const isPhoneCall = session.kind === "phone_call";
  const kind = (session.kind as FrameworkKind) ?? "consultation";
  const proLabel = isPhoneCall
    ? t("phoneLabels.pro")
    : t("consultationLabels.pro");
  const patientLabel = isPhoneCall
    ? t("phoneLabels.patient")
    : t("consultationLabels.patient");

  // Le radar utilise toujours les noms d'étape de la locale UI courante
  // (le step_name stocké en DB est figé dans la langue de la session).
  const framework = useMemo(() => getScorableFramework(kind), [kind]);
  const radarPoints: RadarPoint[] = useMemo(
    () =>
      framework.map((step, index) => {
        const score = scores.find((s) => s.stepNumber === step.number);
        return {
          step: index + 1,
          label: getStepName(step, locale),
          score: score?.score ?? null,
          rationale: score?.rationale ?? null,
        };
      }),
    [framework, scores, locale]
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
        <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
        <TabsTrigger value="transcript">{t("tabs.transcript")}</TabsTrigger>
        <TabsTrigger value="coaching">
          {t("tabs.coaching", { count: insights.length })}
        </TabsTrigger>
        <TabsTrigger value="artifacts">{t("tabs.deliverables")}</TabsTrigger>
        <TabsTrigger value="memory">{t("tabs.memory")}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-surface px-5 py-5 lg:col-span-3">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {t("radarTitle")}
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
              {t("insightsTitle")}
            </h3>
            {topInsights.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noInsights")}</p>
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
              {t("transcriptHeader", { count: lines.length })}
            </h3>
            {insights.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("annotations", { count: insights.length })}
              </span>
            )}
          </div>
          <div className="mt-4 flex max-h-[600px] flex-col gap-3 overflow-y-auto pr-2">
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noTranscript")}</p>
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
                        "mt-0.5 inline-flex h-5 w-16 shrink-0 items-center justify-center self-start rounded-full text-[10px] font-medium uppercase tracking-wide",
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
                {t("annotationsUnattached")}
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
              {t("noInsights")}
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
  const t = useTranslations("results");
  const Icon = INSIGHT_ICON[insight.type] ?? Sparkles;
  const typeLabel =
    (() => {
      try {
        return t(`insightTypes.${insight.type}` as `insightTypes.${"missed_objection" | "upsell_missed" | "good_practice" | "improvement"}`);
      } catch {
        return insight.type;
      }
    })();
  const tone = INSIGHT_TONE[insight.type] ?? NEUTRAL_TONE;

  return (
    <div className={cn("rounded-lg border px-4 py-3", tone.card)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", tone.icon)} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {typeLabel}
            </span>
            {insight.relatedStep && (
              <span className="text-[10px] text-muted-foreground">
                · {t("step", { number: insight.relatedStep })}
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

type CitationLink =
  | { kind: "external"; href: string }
  | { kind: "internal"; href: string }
  | null;

function citationLink(c: InsightCitation): CitationLink {
  if (c.driveFileId) {
    if (c.sourceType === "pdf" || c.sourceType === "docx") {
      return {
        kind: "external",
        href: `/api/file/${encodeURIComponent(c.driveFileId)}`,
      };
    }
  }
  if (!c.programSlug) return null;
  if (c.moduleNumber !== null) {
    return {
      kind: "internal",
      href: `/catalogue/${c.programSlug}#module-${c.moduleNumber}`,
    };
  }
  return { kind: "internal", href: `/catalogue/${c.programSlug}` };
}

function Citations({ citations }: { citations: InsightCitation[] }) {
  const t = useTranslations("results");
  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {t("trainingSources")}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {citations.map((c) => {
          const link = citationLink(c);
          const inner = (
            <>
              <MessageSquare
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate text-muted-foreground">
                <span className="text-ink">{c.sourceFile}</span>
                {c.moduleNumber !== null && ` · module ${c.moduleNumber}`}
              </span>
            </>
          );
          const className =
            "flex items-center gap-2 rounded hover:bg-muted/40 -mx-1 px-1 py-0.5 transition-colors [&>span>span:first-child]:hover:underline";
          return (
            <li key={c.id} className="text-xs">
              {link?.kind === "external" ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {inner}
                </a>
              ) : link?.kind === "internal" ? (
                <Link
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-2">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InlineAnnotation({
  insight,
}: {
  insight: Bundle["insights"][number];
}) {
  const t = useTranslations("results");
  const Icon = INSIGHT_ICON[insight.type] ?? Sparkles;
  const typeLabel =
    (() => {
      try {
        return t(`insightTypes.${insight.type}` as `insightTypes.${"missed_objection" | "upsell_missed" | "good_practice" | "improvement"}`);
      } catch {
        return insight.type;
      }
    })();
  const tone = INSIGHT_TONE[insight.type] ?? NEUTRAL_TONE;

  return (
    <div className={cn("rounded-md border px-2.5 py-1.5 text-[11px]", tone.inline)}>
      <div className="flex items-start gap-1.5">
        <Icon className={cn("mt-0.5 size-3 shrink-0", tone.icon)} aria-hidden />
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
  const t = useTranslations("results.memory");
  const tNav = useTranslations("nav");
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
            <h3 className="text-sm font-medium text-ink">{t("title")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <VaultLinkCard
          title={t("practitionerCardTitle")}
          description={t("practitionerCardDescription")}
          link={bundle.practitionerVault}
          recent={recentlyUpdated(bundle.practitionerVault)}
        />
        <VaultLinkCard
          title={t("sessionCardTitle")}
          description={t("sessionCardDescription")}
          link={bundle.sessionVault}
          recent={recentlyUpdated(bundle.sessionVault)}
        />
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface-muted px-5 py-3 text-xs text-muted-foreground">
        {t("fullVault")}{" "}
        <a
          href="/admin/vault"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          {tNav("memory")}
        </a>
        .
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
  const t = useTranslations("results.memory");
  if (!link) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-4">
        <h4 className="text-sm font-medium text-ink">{title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <p className="mt-3 text-xs italic text-muted-foreground">
          {t("comingSoon")}
        </p>
      </div>
    );
  }
  const href = `/admin/vault/${link.path.replace(/\.md$/, "")}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-lg border border-border bg-surface px-4 py-4 transition hover:border-brand/40 hover:bg-brand/5"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {recent && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
            {t("justUpdated")}
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
