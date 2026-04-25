"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  FileText,
  Mic,
  Sheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramFile, ProgramModule } from "@/lib/programs";

export type ClientProgressEntry = {
  driveFileId: string;
  watchedSeconds: number;
  durationSeconds: number | null;
  completedAt: string | null;
};

type ProgressMap = Record<string, ClientProgressEntry>;

export function ProgramModules({
  modules,
  initialProgress,
}: {
  modules: ProgramModule[];
  initialProgress: ClientProgressEntry[];
}) {
  const [progress, setProgress] = useState<ProgressMap>(() => {
    const m: ProgressMap = {};
    for (const p of initialProgress) m[p.driveFileId] = p;
    return m;
  });
  const [hashTarget, setHashTarget] = useState<number | null>(null);

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

  return (
    <div className="flex flex-col gap-3">
      {modules.map((m, idx) => (
        <ModuleAccordion
          key={`${m.number}-${idx}`}
          mod={m}
          progress={progress}
          onLocalUpdate={updateLocal}
          defaultOpen={idx === 0}
          forceOpen={hashTarget === m.number}
        />
      ))}
    </div>
  );
}

function ModuleAccordion({
  mod,
  progress,
  onLocalUpdate,
  defaultOpen,
  forceOpen,
}: {
  mod: ProgramModule;
  progress: ProgressMap;
  onLocalUpdate: (entry: ClientProgressEntry) => void;
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
          {mod.number > 0 ? mod.number : "·"}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {mod.number > 0
              ? `Module ${mod.number}`
              : "Ressources complémentaires"}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {mod.video && <NatureBadge type="video" />}
            {mod.pdfs.length > 0 && (
              <NatureBadge type="pdf" count={mod.pdfs.length} />
            )}
            {mod.docxs.length > 0 && (
              <NatureBadge type="docx" count={mod.docxs.length} />
            )}
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
        </div>
      )}
    </div>
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

const BADGE_ICON = { video: Mic, pdf: FileText, docx: Sheet } as const;
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
                  href={`/api/pdf/${encodeURIComponent(f.driveFileId)}`}
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
