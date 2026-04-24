"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveLine } from "./use-deepgram-live";
import type { FrameworkKind } from "@/lib/frameworks";

export type CoachBubbleType =
  | "missed_objection"
  | "upsell_missed"
  | "good_practice"
  | "improvement";

export type CoachBubbleSeverity = "info" | "warning" | "critical";

export type CoachBubble = {
  id: string;
  type: CoachBubbleType;
  severity: CoachBubbleSeverity;
  title: string;
  description: string;
  timestampMs: number | null;
  relatedStep: number | null;
  createdAt: number;
};

const TICK_INTERVAL_MS = 20_000;
const COOLDOWN_AFTER_BUBBLE_MS = 12_000;
const WINDOW_MS = 60_000;
const MIN_LINES_TO_TICK = 3;

export function useLiveCoach({
  sessionId,
  kind,
  lines,
  enabled,
}: {
  sessionId: string;
  kind: FrameworkKind;
  lines: LiveLine[];
  enabled: boolean;
}) {
  const [bubbles, setBubbles] = useState<CoachBubble[]>([]);
  const [pending, setPending] = useState(false);
  const linesRef = useRef<LiveLine[]>(lines);
  const bubblesRef = useRef<CoachBubble[]>([]);
  const lastTickLinesCountRef = useRef<number>(0);
  const lastBubbleAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  linesRef.current = lines;
  useEffect(() => {
    bubblesRef.current = bubbles;
  }, [bubbles]);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      if (inFlightRef.current) return;
      const current = linesRef.current;
      if (current.length < MIN_LINES_TO_TICK) return;
      if (current.length === lastTickLinesCountRef.current) return;

      const now = Date.now();
      if (now - lastBubbleAtRef.current < COOLDOWN_AFTER_BUBBLE_MS) return;

      lastTickLinesCountRef.current = current.length;

      const maxEndMs = current[current.length - 1].endMs;
      const windowStart = Math.max(0, maxEndMs - WINDOW_MS);
      const windowLines = current.filter(
        (l) => l.endMs >= windowStart && l.startMs <= maxEndMs
      );

      const excludeRelatedSteps = Array.from(
        new Set(
          bubblesRef.current
            .map((b) => b.relatedStep)
            .filter((s): s is number => s != null)
        )
      );

      inFlightRef.current = true;
      setPending(true);
      try {
        const res = await fetch("/api/coach/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            frameworkKind: kind,
            lines: windowLines.map((l) => ({
              speaker: l.speaker,
              startMs: l.startMs,
              endMs: l.endMs,
              text: l.text,
            })),
            excludeRelatedSteps,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          insight: {
            type: CoachBubbleType;
            severity: CoachBubbleSeverity;
            title: string;
            description: string;
            timestamp_ms: number | null;
            related_step: number | null;
          } | null;
        };
        if (data.insight) {
          const bubble: CoachBubble = {
            id: `coach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: data.insight.type,
            severity: data.insight.severity,
            title: data.insight.title,
            description: data.insight.description,
            timestampMs: data.insight.timestamp_ms,
            relatedStep: data.insight.related_step,
            createdAt: Date.now(),
          };
          setBubbles((prev) => [bubble, ...prev]);
          lastBubbleAtRef.current = Date.now();
        }
      } catch (err) {
        console.warn("coach tick failed", err);
      } finally {
        inFlightRef.current = false;
        setPending(false);
      }
    };

    const interval = setInterval(() => void tick(), TICK_INTERVAL_MS);
    const warmup = setTimeout(() => void tick(), 4_000);
    return () => {
      clearInterval(interval);
      clearTimeout(warmup);
    };
  }, [enabled, sessionId, kind]);

  return { bubbles, pending };
}
