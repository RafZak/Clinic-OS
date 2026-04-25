"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Headphones,
  PackageCheck,
  Phone,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { EVENT_LABEL, type PatientEventRow } from "@/lib/patients-shared";
import { formatDuration, formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  phone_call: Phone,
  appointment_scheduled: CalendarCheck,
  consultation: Stethoscope,
  trial_start: Headphones,
  delivery: PackageCheck,
  follow_up: CheckCircle2,
} as const;

const KIND_DOT_CLASS: Record<PatientEventRow["kind"], string> = {
  phone_call: "bg-sky-500 ring-sky-100",
  appointment_scheduled: "bg-violet-500 ring-violet-100",
  consultation: "bg-brand ring-brand/15",
  trial_start: "bg-amber-500 ring-amber-100",
  delivery: "bg-emerald-500 ring-emerald-100",
  follow_up: "bg-slate-500 ring-slate-200",
};

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(date: Date): string {
  const diffDays = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "hier";
  if (diffDays > 0) return `il y a ${diffDays} j`;
  return `dans ${Math.abs(diffDays)} j`;
}

function formatMetadata(
  kind: PatientEventRow["kind"],
  meta: Record<string, unknown> | null
): string[] {
  if (!meta) return [];
  const out: string[] = [];
  if (kind === "appointment_scheduled" && typeof meta.scheduled_for === "string") {
    const dt = new Date(meta.scheduled_for);
    if (!Number.isNaN(dt.getTime())) {
      out.push(
        `Créneau : ${dt.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })} ${dt.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      );
    }
  }
  if (
    (kind === "trial_start" || kind === "delivery") &&
    typeof meta.product === "string"
  ) {
    out.push(`Produit : ${meta.product}${meta.class ? ` (classe ${meta.class})` : ""}`);
  }
  if (typeof meta.price_eur === "number") {
    out.push(`Prix : ${formatEur(meta.price_eur)}`);
  }
  if (kind === "trial_start" && typeof meta.trial_days === "number") {
    out.push(`Essai : ${meta.trial_days} jours`);
  }
  if (kind === "follow_up" && typeof meta.duration_min === "number") {
    out.push(`Durée : ${meta.duration_min} min`);
  }
  if (typeof meta.lost_reason === "string") {
    const labels: Record<string, string> = {
      objection_prix_non_traitee: "Objection prix non traitée",
    };
    out.push(`Motif : ${labels[meta.lost_reason] ?? meta.lost_reason}`);
  }
  return out;
}

function eventLink(event: PatientEventRow): string | null {
  if (event.kind === "consultation" && event.sessionId) {
    return `/consultations/${event.sessionId}`;
  }
  if (
    event.kind === "phone_call" &&
    event.sessionId &&
    (event.sessionHasTranscript || event.sessionAnalysisStatus === "done")
  ) {
    return `/appels/${event.sessionId}`;
  }
  return null;
}

export function PatientTimeline({ events }: { events: PatientEventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
        Aucun événement enregistré pour ce patient.
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div
        aria-hidden
        className="absolute left-[0.4375rem] top-2 bottom-2 w-px bg-border"
      />
      <ol className="flex flex-col gap-1.5">
        {events.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </ol>
    </div>
  );
}

function TimelineItem({ event }: { event: PatientEventRow }) {
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICON[event.kind];
  const link = eventLink(event);
  const metaLines = formatMetadata(event.kind, event.metadata);
  const hasDetails =
    Boolean(event.summary) ||
    metaLines.length > 0 ||
    event.sessionDurationSeconds != null ||
    Boolean(link);

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[1.45rem] top-3.5 block h-2.5 w-2.5 rounded-full ring-4",
          KIND_DOT_CLASS[event.kind]
        )}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
        className={cn(
          "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
          hasDetails ? "hover:bg-surface-muted/60" : "cursor-default"
        )}
      >
        <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-foreground">
          {formatShortDate(event.occurredAt)}
        </span>
        <Icon
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {EVENT_LABEL[event.kind]}
        </span>
        {event.sessionGlobalScore != null && (
          <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {event.sessionGlobalScore}/100
          </span>
        )}
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
          {formatRelative(event.occurredAt)}
        </span>
        {hasDetails && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
        )}
      </button>
      {open && hasDetails && (
        <div className="ml-3 mt-1 mb-1 flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3">
          {event.summary && (
            <p className="text-sm leading-relaxed text-foreground/90">
              {event.summary}
            </p>
          )}
          {metaLines.length > 0 && (
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
              {metaLines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          )}
          {event.sessionDurationSeconds != null && (
            <p className="text-xs text-muted-foreground">
              Durée : {formatDuration(event.sessionDurationSeconds)}
            </p>
          )}
          {link && (
            <Link
              href={link}
              className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand hover:text-brand-dark"
            >
              <Sparkles className="h-3 w-3" />
              Voir l&apos;analyse de la session
            </Link>
          )}
          {event.sessionId && !link && (
            <p className="text-xs italic text-muted-foreground">
              Replay de session non disponible (transcript en attente).
            </p>
          )}
        </div>
      )}
    </li>
  );
}
