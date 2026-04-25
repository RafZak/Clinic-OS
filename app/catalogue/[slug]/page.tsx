import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/layout/page-header";
import {
  getProgramBySlug,
  getProgramModules,
  moduleDriveIds,
} from "@/lib/programs";
import { loadProgressMap } from "@/lib/module-progress";
import { getRole } from "@/lib/role";
import {
  ProgramModules,
  type ClientProgressEntry,
  type ClientQuizEntry,
} from "@/components/catalogue/program-modules";
import {
  getBestAttemptsByPractitioner,
  listQuizSetsForProgram,
} from "@/lib/quizzes";
import { getCurrentQuizPractitioner } from "@/lib/quiz-identity";

export const dynamic = "force-dynamic";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) notFound();

  const role = await getRole();
  const [modules, progressMap, quizSets, practitioner] = await Promise.all([
    getProgramModules(slug),
    loadProgressMap(role),
    listQuizSetsForProgram(slug),
    getCurrentQuizPractitioner(role),
  ]);

  const attemptsMap = practitioner
    ? await getBestAttemptsByPractitioner(
        practitioner.id,
        quizSets.map((q) => q.id)
      )
    : new Map();

  const clientQuizzes: ClientQuizEntry[] = quizSets.map((q) => {
    const a = attemptsMap.get(q.id);
    return {
      id: q.id,
      title: q.title,
      ordinal: q.ordinal,
      moduleNumber: q.moduleNumber,
      passThreshold: q.passThreshold,
      bestScore: a ? a.score : null,
      passed: a ? a.passed : false,
      lastAttemptAt: a?.completedAt ? a.completedAt.toISOString() : null,
    };
  });

  const completedModules = modules.filter((m) => {
    const ids = moduleDriveIds(m);
    if (ids.length === 0) return false;
    return ids.every((id) => progressMap.get(id)?.completedAt != null);
  }).length;

  const initialProgress: ClientProgressEntry[] = [];
  for (const m of modules) {
    for (const id of moduleDriveIds(m)) {
      const entry = progressMap.get(id);
      if (entry) {
        initialProgress.push({
          driveFileId: entry.driveFileId,
          watchedSeconds: entry.watchedSeconds,
          durationSeconds: entry.durationSeconds,
          completedAt: entry.completedAt
            ? entry.completedAt.toISOString()
            : null,
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/catalogue"
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Catalogue
      </Link>

      <PageHeader
        title={program.title}
        description={program.description}
        actions={
          program.isAvailable ? (
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand">
              Actif
            </span>
          ) : (
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bientôt disponible
            </span>
          )
        }
      />

      {!program.isAvailable ? (
        <PlaceholderBlock>
          Ce programme sera ajouté à une prochaine itération. Pas d&apos;ingestion
          pour l&apos;instant.
        </PlaceholderBlock>
      ) : modules.length === 0 ? (
        <PlaceholderBlock>
          Aucun fichier ingéré pour ce programme. Lance{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5">
            pnpm ingest --program {slug}
          </code>
          .
        </PlaceholderBlock>
      ) : (
        <div className="flex flex-col gap-5">
          <CompletionBar
            completed={completedModules}
            total={modules.length}
          />
          <ProgramModules
            modules={modules}
            initialProgress={initialProgress}
            quizzes={clientQuizzes}
          />
        </div>
      )}
    </div>
  );
}

function CompletionBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Complétion du programme
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {completed} / {total}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            modules · {pct}%
          </span>
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
