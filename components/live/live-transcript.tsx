"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { LiveLine } from "@/hooks/use-deepgram-live";

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function LiveTranscript({
  lines,
  interim,
  showSpeaker = false,
  footerNote,
  title,
  practitionerLabel,
  patientLabel,
}: {
  lines: LiveLine[];
  interim: string;
  showSpeaker?: boolean;
  footerNote?: string | null;
  title?: string;
  practitionerLabel?: string;
  patientLabel?: string;
}) {
  const t = useTranslations("live");
  const endRef = useRef<HTMLDivElement | null>(null);

  const resolvedTitle = title ?? t("transcriptTitle");
  const resolvedFooter =
    footerNote === null
      ? null
      : footerNote ?? t("voicesNote");
  const resolvedPro = practitionerLabel ?? "Pro";
  const resolvedPatient = patientLabel ?? "Patient";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, interim]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{resolvedTitle}</span>
        <span>{t("linesCount", { count: lines.length })}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 && !interim && (
          <p className="text-sm text-muted-foreground">
            {t("waitingFirstSpeech")}
          </p>
        )}
        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.id} className="flex gap-3">
              <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {formatMs(l.startMs)}
              </span>
              {showSpeaker && (
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    l.speaker === "practitioner"
                      ? "bg-brand/10 text-brand"
                      : "bg-surface-muted text-muted-foreground"
                  }`}
                >
                  {l.speaker === "practitioner" ? resolvedPro : resolvedPatient}
                </span>
              )}
              <p className="text-sm leading-relaxed text-ink">{l.text}</p>
            </li>
          ))}
          {interim && (
            <li className="flex gap-3 opacity-60">
              <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                --:--
              </span>
              <p className="text-sm italic leading-relaxed text-muted-foreground">{interim}</p>
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>
      {resolvedFooter && (
        <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          {resolvedFooter}
        </div>
      )}
    </div>
  );
}
