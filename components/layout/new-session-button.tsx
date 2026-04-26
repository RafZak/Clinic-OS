"use client";

import { Mic, Plus, Radio, UserPlus, User, Search } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listPatientsLite,
  startLiveSession,
  startReplaySession,
  type PatientSummary,
} from "@/app/actions/sessions";
import { REPLAY_SCENARIOS } from "@/scripts/replay/scripts";
import { REPLAY_PHONE_SCENARIOS } from "@/scripts/replay/scripts-phone";
import type { Role } from "@/lib/role";

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m${s.toString().padStart(2, "0")}`;
}

export function NewSessionButton({ role }: { role: Role }) {
  const t = useTranslations("newSession");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [replayPendingSlug, setReplayPendingSlug] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPro = role === "audioprothesiste";
  const label = isPro ? t("consultationLabel") : t("phoneLabel");
  const kind = isPro ? "consultation" : "phone_call";

  useEffect(() => {
    if (open) {
      listPatientsLite()
        .then(setPatients)
        .catch(() => setPatients([]));
    } else {
      setQuery("");
      setPickedId(null);
    }
  }, [open]);

  const trimmed = query.trim();
  const lowered = trimmed.toLowerCase();
  const matches = useMemo(() => {
    if (lowered.length === 0) return [];
    return patients
      .filter((p) => p.label.toLowerCase().includes(lowered))
      .slice(0, 5);
  }, [lowered, patients]);
  const exactMatch = useMemo(
    () => patients.find((p) => p.label.toLowerCase() === lowered) ?? null,
    [lowered, patients]
  );
  const pickedPatient = pickedId
    ? patients.find((p) => p.id === pickedId) ?? null
    : null;

  const onPick = (p: PatientSummary) => {
    setPickedId(p.id);
    setQuery(p.label);
    inputRef.current?.blur();
  };

  const onChangeQuery = (v: string) => {
    setQuery(v);
    if (pickedId) setPickedId(null);
  };

  const startLabel = pickedPatient
    ? t("startWith", { label: pickedPatient.label })
    : exactMatch
      ? t("startWith", { label: exactMatch.label })
      : trimmed.length > 0
        ? t("createAndStart", { label: trimmed })
        : t("startWithout");

  const onStart = () => {
    startTransition(async () => {
      if (pickedPatient) {
        await startLiveSession(kind, { patientId: pickedPatient.id });
      } else if (exactMatch) {
        await startLiveSession(kind, { patientId: exactMatch.id });
      } else if (trimmed.length > 0) {
        await startLiveSession(kind, { newPatientName: trimmed });
      } else {
        await startLiveSession(kind);
      }
    });
  };

  const onReplay = (slug: string) => {
    setReplayPendingSlug(slug);
    startTransition(async () => {
      await startReplaySession(slug);
    });
  };

  const showSuggestions =
    !pickedId && matches.length > 0 && lowered.length >= 1 && !exactMatch;

  return (
    <>
      <Button
        size="sm"
        className="bg-brand text-primary-foreground hover:bg-brand-dark"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {isPro ? t("consultationDescription") : t("phoneDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 pt-2">
            <div className="rounded-md border border-border bg-surface px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Mic className="size-3.5" aria-hidden />
                {t("startLive")}
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => onChangeQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !pending) {
                      e.preventDefault();
                      onStart();
                    }
                  }}
                  placeholder={
                    isPro ? t("patientPlaceholder") : t("callerPlaceholder")
                  }
                  className="pl-9"
                  disabled={pending}
                />

                {showSuggestions && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-surface shadow-lg">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onPick(p)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                        >
                          <User className="size-3.5 text-muted-foreground" aria-hidden />
                          <span className="flex-1 truncate">{p.label}</span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {p.status === "patient"
                              ? t("patientStatusWon")
                              : p.status === "lost"
                                ? t("patientStatusLost")
                                : t("patientStatusProspect")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {trimmed.length > 0 && !exactMatch && !pickedId && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <UserPlus className="size-3" aria-hidden />
                  {t("noPatientFound")}
                </p>
              )}

              <Button
                type="button"
                onClick={onStart}
                disabled={pending}
                className="mt-3 w-full bg-brand text-primary-foreground hover:bg-brand-dark"
              >
                {pending && !replayPendingSlug ? t("creating") : startLabel}
              </Button>
            </div>

            {isPro && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Radio className="size-3.5" aria-hidden />
                  {t("replayConsultation")}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {REPLAY_SCENARIOS.map((scenario) => {
                    const isPending = pending && replayPendingSlug === scenario.slug;
                    return (
                      <button
                        key={scenario.slug}
                        type="button"
                        onClick={() => onReplay(scenario.slug)}
                        disabled={pending}
                        className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-left transition hover:border-brand hover:bg-brand/5 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">
                            {scenario.patientLabel.replace(/^Mme |^M\. |^Mrs\. |^Mr\. /, "")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
                            {scenario.targetScore}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {scenario.label.split("—")[1]?.trim() ?? scenario.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDuration(scenario.targetDurationSeconds)}
                          {isPending ? ` · ${t("launching")}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isPro && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Radio className="size-3.5" aria-hidden />
                  {t("replayPhone")}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REPLAY_PHONE_SCENARIOS.map((scenario) => {
                    const isPending = pending && replayPendingSlug === scenario.slug;
                    return (
                      <button
                        key={scenario.slug}
                        type="button"
                        onClick={() => onReplay(scenario.slug)}
                        disabled={pending}
                        className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-left transition hover:border-brand hover:bg-brand/5 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">
                            {scenario.callerLabel.replace(/^Mme |^M\. |^Mrs\. |^Mr\. /, "")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
                            {scenario.targetScore}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {scenario.label.split("—")[1]?.trim() ?? scenario.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDuration(scenario.targetDurationSeconds)}
                          {isPending ? ` · ${t("launching")}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
