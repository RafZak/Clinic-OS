import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  Headphones,
  PackageCheck,
  Phone,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { EVENT_LABEL, type PatientEventRow } from "@/lib/patients";
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
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
    <div className="relative pl-8">
      <div
        aria-hidden
        className="absolute left-3 top-2 bottom-2 w-px bg-border"
      />
      <ol className="flex flex-col gap-5">
        {events.map((event) => {
          const Icon = KIND_ICON[event.kind];
          const link = eventLink(event);
          const metaLines = formatMetadata(event.kind, event.metadata);

          const card = (
            <div
              className={cn(
                "rounded-lg border border-border bg-surface px-5 py-4 transition-colors",
                link && "group-hover:border-brand/40 group-hover:shadow-sm"
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {EVENT_LABEL[event.kind]}
                  {event.sessionGlobalScore != null && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {event.sessionGlobalScore}/100
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(event.occurredAt)} ·{" "}
                  <span className="text-muted-foreground/80">
                    {formatRelative(event.occurredAt)}
                  </span>
                </div>
              </div>

              {event.summary && (
                <p className="mt-2 text-sm text-foreground/90">{event.summary}</p>
              )}

              {metaLines.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {metaLines.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              )}

              {event.sessionDurationSeconds != null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Durée : {formatDuration(event.sessionDurationSeconds)}
                </p>
              )}

              {link && (
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand">
                  <Sparkles className="h-3 w-3" />
                  Voir l&apos;analyse de la session
                </p>
              )}
              {event.sessionId && !link && (
                <p className="mt-3 text-xs italic text-muted-foreground">
                  Replay de session non disponible (transcript en attente).
                </p>
              )}
            </div>
          );

          return (
            <li key={event.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[1.45rem] top-3 block h-3 w-3 rounded-full ring-4",
                  KIND_DOT_CLASS[event.kind]
                )}
                aria-hidden
              />
              {link ? (
                <Link href={link} className="group block">
                  {card}
                </Link>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
