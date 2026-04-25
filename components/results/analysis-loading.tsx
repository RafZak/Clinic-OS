"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | "pending"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "done"
  | "failed";

const STEPS: { key: Status[]; label: string }[] = [
  { key: ["pending"], label: "Préparation de l'analyse" },
  { key: ["transcribing"], label: "Ré-attribution des voix" },
  { key: ["transcribed", "analyzing"], label: "Analyse de la consultation par l'IA" },
  { key: ["done"], label: "Résultats prêts" },
];

export function AnalysisLoading({
  sessionId,
  initialStatus,
}: {
  sessionId: string;
  initialStatus: Status;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef<number | null>(null);

  useEffect(() => {
    t0.current = Date.now();
    const tick = setInterval(() => {
      if (t0.current) setElapsed(Date.now() - t0.current);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { analysisStatus: Status };
        if (cancelled) return;
        setStatus(data.analysisStatus);
        if (data.analysisStatus === "done" || data.analysisStatus === "failed") {
          router.refresh();
        }
      } catch {
        // silencieux : on retentera au prochain tick
      }
    };
    const interval = setInterval(poll, 3000);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, router]);

  const currentIdx = STEPS.findIndex((s) => s.key.includes(status));
  const elapsedSec = Math.floor(elapsed / 1000);

  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-8">
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-ink">Analyse en cours</h2>
          <p className="text-sm text-muted-foreground">
            Durée écoulée : {elapsedSec}s · estimation 20-40s au total
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {STEPS.map((step, idx) => {
          const state =
            idx < currentIdx ? "done" : idx === currentIdx ? "active" : "pending";
          return (
            <li
              key={step.label}
              className={cn(
                "flex items-center gap-3 rounded-md border px-4 py-3 text-sm",
                state === "done" && "border-border bg-light/40 text-ink",
                state === "active" && "border-brand/40 bg-brand/5 text-ink",
                state === "pending" && "border-border/60 bg-transparent text-muted-foreground"
              )}
            >
              <span className="flex size-6 items-center justify-center">
                {state === "done" && (
                  <CheckCircle2 className="size-5 text-brand" aria-hidden />
                )}
                {state === "active" && (
                  <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
                )}
                {state === "pending" && (
                  <span className="size-2 rounded-full bg-border" />
                )}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-xs text-muted-foreground">
        La page se rechargera automatiquement quand l&apos;analyse sera prête.
      </p>
    </div>
  );
}
