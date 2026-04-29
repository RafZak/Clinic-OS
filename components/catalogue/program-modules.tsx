"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  FileText,
  PlayCircle,
  RotateCcw,
  Sheet,
  Sparkles,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramFile, ProgramModule } from "@/lib/programs";
import type { QuizSetWithQuestions } from "@/lib/quizzes";
import { loadQuizSetAction } from "@/app/actions/quizzes";
import { QuizRunner } from "./quiz-runner";

export type ClientProgressEntry = {
  driveFileId: string;
  watchedSeconds: number;
  durationSeconds: number | null;
  completedAt: string | null;
};

export type ClientQuizEntry = {
  id: string;
  title: string;
  ordinal: number;
  moduleNumber: number | null;
  passThreshold: number;
  bestScore: number | null;
  passed: boolean;
  lastAttemptAt: string | null;
};

type ProgressMap = Record<string, ClientProgressEntry>;
type QuizMap = Record<string, ClientQuizEntry>;

export function ProgramModules({
  modules: rawModules,
  initialProgress,
  quizzes = [],
}: {
  modules: ProgramModule[];
  initialProgress: ClientProgressEntry[];
  quizzes?: ClientQuizEntry[];
}) {
  const modules = useMemo(
    () => rawModules.filter((m) => m.number > 0),
    [rawModules]
  );
  const [progress, setProgress] = useState<ProgressMap>(() => {
    const m: ProgressMap = {};
    for (const p of initialProgress) m[p.driveFileId] = p;
    return m;
  });
  const [quizState, setQuizState] = useState<QuizMap>(() => {
    const m: QuizMap = {};
    for (const q of quizzes) m[q.id] = q;
    return m;
  });
  const [hashTarget, setHashTarget] = useState<number | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<QuizSetWithQuestions | null>(null);
  const [loadingQuizId, setLoadingQuizId] = useState<string | null>(null);
  const [, startQuizLoad] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readHash = () => {
      const m = window.location.hash.match(/^#module-(\d+)$/);
      const target = m ? parseInt(m[1], 10) : null;
      setHashTarget(target);
      if (target != null) {
        setTimeout(() => {
          const el = document.getElementById(`module-${target}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const updateLocal = useCallback((entry: ClientProgressEntry) => {
    setProgress((prev) => ({ ...prev, [entry.driveFileId]: entry }));
  }, []);

  const moduleNumbers = useMemo(
    () => new Set(modules.map((m) => m.number)),
    [modules]
  );

  const quizzesByModule = useMemo(() => {
    const m = new Map<number, ClientQuizEntry[]>();
    for (const q of quizzes) {
      if (q.moduleNumber == null || q.moduleNumber === 0) continue;
      if (!moduleNumbers.has(q.moduleNumber)) continue;
      const arr = m.get(q.moduleNumber) ?? [];
      arr.push(quizState[q.id] ?? q);
      m.set(q.moduleNumber, arr);
    }
    return m;
  }, [quizzes, quizState, moduleNumbers]);

  const transverseQuizzes = useMemo(
    () =>
      quizzes
        .filter((q) => {
          if (q.moduleNumber === 0) return false;
          return q.moduleNumber == null || !moduleNumbers.has(q.moduleNumber);
        })
        .map((q) => quizState[q.id] ?? q),
    [quizzes, quizState, moduleNumbers]
  );

  const openQuiz = useCallback(
    (quizSetId: string) => {
      setLoadingQuizId(quizSetId);
      startQuizLoad(async () => {
        const set = await loadQuizSetAction(quizSetId);
        setLoadingQuizId(null);
        if (set) setActiveQuiz(set);
      });
    },
    []
  );

  return (
    <div className="flex flex-col gap-3">
      {modules.map((m, idx) => (
        <ModuleAccordion
          key={`${m.number}-${idx}`}
          mod={m}
          progress={progress}
          onLocalUpdate={updateLocal}
          quizzes={quizzesByModule.get(m.number) ?? []}
          loadingQuizId={loadingQuizId}
          onOpenQuiz={openQuiz}
          defaultOpen={idx === 0}
          forceOpen={hashTarget === m.number}
        />
      ))}

      {transverseQuizzes.length > 0 && (
        <TransverseQuizzes
          quizzes={transverseQuizzes}
          loadingQuizId={loadingQuizId}
          onOpenQuiz={openQuiz}
        />
      )}

      {activeQuiz && (
        <QuizRunner
          open={true}
          onOpenChange={(v) => !v && setActiveQuiz(null)}
          quiz={activeQuiz}
          onCompleted={(r) =>
            setQuizState((prev) => ({
              ...prev,
              [activeQuiz.id]: {
                ...(prev[activeQuiz.id] ?? {
                  id: activeQuiz.id,
                  title: activeQuiz.title,
                  ordinal: activeQuiz.ordinal,
                  moduleNumber: activeQuiz.moduleNumber,
                  passThreshold: activeQuiz.passThreshold,
                }),
                bestScore:
                  prev[activeQuiz.id]?.bestScore != null
                    ? Math.max(prev[activeQuiz.id]!.bestScore!, r.score)
                    : r.score,
                passed: r.passed || (prev[activeQuiz.id]?.passed ?? false),
                lastAttemptAt: new Date().toISOString(),
              },
            }))
          }
        />
      )}
    </div>
  );
}

function TransverseQuizzes({
  quizzes,
  loadingQuizId,
  onOpenQuiz,
}: {
  quizzes: ClientQuizEntry[];
  loadingQuizId: string | null;
  onOpenQuiz: (id: string) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Quiz transverses
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Validation pédagogique du programme · ≥ 80%
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {quizzes.map((q) => (
          <QuizCard
            key={q.id}
            quiz={q}
            loading={loadingQuizId === q.id}
            onOpen={() => onOpenQuiz(q.id)}
          />
        ))}
      </div>
    </div>
  );
}

function QuizCard({
  quiz,
  loading,
  onOpen,
}: {
  quiz: ClientQuizEntry;
  loading: boolean;
  onOpen: () => void;
}) {
  const hasAttempt = quiz.bestScore != null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            quiz.passed
              ? "bg-emerald-50 text-emerald-700"
              : hasAttempt
                ? "bg-amber-50 text-amber-700"
                : "bg-violet-50 text-violet-700"
          )}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{quiz.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {quiz.passed ? (
              <span className="font-medium text-emerald-700">
                Validé · meilleur score {quiz.bestScore}%
              </span>
            ) : hasAttempt ? (
              <span className="font-medium text-amber-700">
                Dernière tentative {quiz.bestScore}% — à repasser
              </span>
            ) : (
              <span>
                Quiz à passer · score à atteindre ≥ {quiz.passThreshold}%
              </span>
            )}
          </p>
        </div>
      </div>
      <button
        onClick={onOpen}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          loading
            ? "bg-surface-muted text-muted-foreground"
            : hasAttempt
              ? "border border-border bg-white text-foreground hover:bg-surface-muted/40"
              : "bg-brand text-white hover:bg-brand-dark"
        )}
      >
        {loading ? (
          "Chargement…"
        ) : hasAttempt ? (
          <>
            <RotateCcw className="h-3.5 w-3.5" />
            Repasser
          </>
        ) : (
          <>
            <PlayCircle className="h-3.5 w-3.5" />
            Lancer le quiz
          </>
        )}
      </button>
    </div>
  );
}

function ModuleAccordion({
  mod,
  progress,
  onLocalUpdate,
  quizzes,
  loadingQuizId,
  onOpenQuiz,
  defaultOpen,
  forceOpen,
}: {
  mod: ProgramModule;
  progress: ProgressMap;
  onLocalUpdate: (entry: ClientProgressEntry) => void;
  quizzes: ClientQuizEntry[];
  loadingQuizId: string | null;
  onOpenQuiz: (id: string) => void;
  defaultOpen?: boolean;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    if (mod.video) ids.push(mod.video.driveFileId);
    for (const p of mod.pdfs) ids.push(p.driveFileId);
    for (const d of mod.docxs) ids.push(d.driveFileId);
    return ids;
  }, [mod]);

  const completed = useMemo(() => {
    if (allIds.length === 0) return false;
    return allIds.every((id) => progress[id]?.completedAt != null);
  }, [allIds, progress]);

  const inProgress = useMemo(
    () => allIds.some((id) => progress[id]?.watchedSeconds),
    [allIds, progress]
  );

  const videoEntry = mod.video ? progress[mod.video.driveFileId] : null;
  const videoPct = videoEntry?.durationSeconds
    ? Math.min(
        100,
        Math.round(
          (videoEntry.watchedSeconds / videoEntry.durationSeconds) * 100
        )
      )
    : 0;

  return (
    <div
      id={`module-${mod.number}`}
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface scroll-mt-20",
        forceOpen && "ring-2 ring-brand/30"
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          open ? "bg-surface-muted/50" : "hover:bg-surface-muted/30"
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            completed
              ? "bg-emerald-50 text-emerald-700"
              : inProgress
                ? "bg-amber-50 text-amber-700"
                : "bg-surface-muted text-muted-foreground"
          )}
        >
          {mod.number}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {`Module ${mod.number}`}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {mod.video && <NatureBadge type="video" />}
            {mod.pdfs.length > 0 && (
              <NatureBadge type="pdf" count={mod.pdfs.length} />
            )}
            {mod.docxs.length > 0 && (
              <NatureBadge type="docx" count={mod.docxs.length} />
            )}
            {quizzes.length > 0 && <QuizBadge quizzes={quizzes} />}
            {videoEntry && videoPct > 0 && !completed && (
              <span className="text-muted-foreground">· Vidéo {videoPct}%</span>
            )}
          </div>
        </div>
        <CompletionIcon completed={completed} />
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-border bg-white px-4 py-4">
          {mod.video && (
            <VideoPlayer
              file={mod.video}
              entry={progress[mod.video.driveFileId] ?? null}
              onLocalUpdate={onLocalUpdate}
            />
          )}
          {mod.pdfs.length > 0 && (
            <FileList
              title="Livrets PDF"
              type="pdf"
              files={mod.pdfs}
              progress={progress}
              onLocalUpdate={onLocalUpdate}
            />
          )}
          {mod.docxs.length > 0 && (
            <FileList
              title="Documents"
              type="docx"
              files={mod.docxs}
              progress={progress}
              onLocalUpdate={onLocalUpdate}
            />
          )}
          {quizzes.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Quiz {quizzes.length > 1 ? "(plusieurs)" : ""}
              </p>
              {quizzes.map((q) => (
                <QuizCard
                  key={q.id}
                  quiz={q}
                  loading={loadingQuizId === q.id}
                  onOpen={() => onOpenQuiz(q.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizBadge({ quizzes }: { quizzes: ClientQuizEntry[] }) {
  const passed = quizzes.every((q) => q.passed);
  const tried = quizzes.some((q) => q.bestScore != null);
  const tone = passed
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tried
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-violet-50 text-violet-700 border-violet-200";
  const label = passed ? "Quiz validé" : tried ? "Quiz à repasser" : "Quiz";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone
      )}
    >
      <Sparkles className="h-3 w-3" />
      {label}
      {quizzes.length > 1 ? ` × ${quizzes.length}` : ""}
    </span>
  );
}

function CompletionIcon({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <CheckCircle2
        className="h-5 w-5 shrink-0 text-emerald-500"
        aria-label="Module terminé"
      />
    );
  }
  return (
    <Circle
      className="h-5 w-5 shrink-0 text-muted-foreground/30"
      aria-label="Module non terminé"
    />
  );
}

const BADGE_ICON = { video: Video, pdf: FileText, docx: Sheet } as const;
const BADGE_LABEL = { video: "Vidéo", pdf: "PDF", docx: "DOCX" } as const;
const BADGE_CLS = {
  video: "bg-violet-50 text-violet-700 border-violet-200",
  pdf: "bg-sky-50 text-sky-700 border-sky-200",
  docx: "bg-amber-50 text-amber-700 border-amber-200",
} as const;

function NatureBadge({
  type,
  count,
}: {
  type: "video" | "pdf" | "docx";
  count?: number;
}) {
  const Icon = BADGE_ICON[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        BADGE_CLS[type]
      )}
    >
      <Icon className="h-3 w-3" />
      {BADGE_LABEL[type]}
      {count != null && count > 1 ? ` × ${count}` : ""}
    </span>
  );
}

async function postProgress(
  driveFileId: string,
  watchedSeconds: number,
  durationSeconds: number | null
): Promise<{ completed: boolean } | null> {
  try {
    const r = await fetch("/api/module-progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ driveFileId, watchedSeconds, durationSeconds }),
    });
    if (!r.ok) return null;
    return (await r.json()) as { completed: boolean };
  } catch {
    return null;
  }
}

function VideoPlayer({
  file,
  entry,
  onLocalUpdate,
}: {
  file: ProgramFile;
  entry: ClientProgressEntry | null;
  onLocalUpdate: (entry: ClientProgressEntry) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSentRef = useRef(0);
  const restoredRef = useRef(false);

  const send = useCallback(
    async (watched: number, duration: number | null) => {
      const resp = await postProgress(file.driveFileId, watched, duration);
      onLocalUpdate({
        driveFileId: file.driveFileId,
        watchedSeconds: watched,
        durationSeconds: duration,
        completedAt:
          resp?.completed
            ? new Date().toISOString()
            : entry?.completedAt ?? null,
      });
    },
    [file.driveFileId, onLocalUpdate, entry?.completedAt]
  );

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (
      !restoredRef.current &&
      entry?.watchedSeconds &&
      entry.watchedSeconds > 5 &&
      (!entry.durationSeconds ||
        entry.watchedSeconds < entry.durationSeconds - 2)
    ) {
      v.currentTime = entry.watchedSeconds;
      restoredRef.current = true;
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const now = Date.now();
    if (now - lastSentRef.current < 5000) return;
    lastSentRef.current = now;
    const watched = Math.floor(v.currentTime);
    const duration = Number.isFinite(v.duration) ? Math.floor(v.duration) : null;
    void send(watched, duration);
  };

  const handleEnded = () => {
    const v = videoRef.current;
    if (!v) return;
    const duration = Number.isFinite(v.duration) ? Math.floor(v.duration) : null;
    void send(duration ?? Math.floor(v.currentTime), duration);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          {file.sourceFile}
        </p>
        {entry?.durationSeconds && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {formatTime(entry.watchedSeconds)} / {formatTime(entry.durationSeconds)}
          </span>
        )}
      </div>
      <video
        ref={videoRef}
        controls
        preload="metadata"
        className="w-full rounded-md bg-black"
        src={`/api/video/${file.driveFileId}`}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
    </div>
  );
}

function FileList({
  title,
  type,
  files,
  progress,
  onLocalUpdate,
}: {
  title: string;
  type: "pdf" | "docx";
  files: ProgramFile[];
  progress: ProgressMap;
  onLocalUpdate: (entry: ClientProgressEntry) => void;
}) {
  const Icon = BADGE_ICON[type];

  const handleOpen = useCallback(
    async (driveFileId: string) => {
      const resp = await postProgress(driveFileId, 1, 1);
      onLocalUpdate({
        driveFileId,
        watchedSeconds: 1,
        durationSeconds: 1,
        completedAt: resp?.completed
          ? new Date().toISOString()
          : new Date().toISOString(),
      });
    },
    [onLocalUpdate]
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {files.map((f) => {
          const completed = progress[f.driveFileId]?.completedAt != null;
          return (
            <li
              key={f.driveFileId}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.sourceFile}</span>
              </span>
              <div className="flex items-center gap-3">
                {completed && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <a
                  href={`/api/file/${encodeURIComponent(f.driveFileId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void handleOpen(f.driveFileId)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark"
                >
                  Ouvrir
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatTime(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
