"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuizSetWithQuestions, QuizQuestion } from "@/lib/quizzes";
import { submitQuizAction } from "@/app/actions/quizzes";
import Link from "next/link";

type Phase = "intro" | "question" | "result";

type ResultPayload = {
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  attemptId: string;
  failedModule: number | null;
  programSlug: string;
};

export function QuizRunner({
  open,
  onOpenChange,
  quiz,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quiz: QuizSetWithQuestions;
  onCompleted?: (result: ResultPayload) => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [startedAt, setStartedAt] = useState<number>(0);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ResultPayload | null>(null);

  const total = quiz.questions.length;
  const current = quiz.questions[idx];

  const reset = useCallback(() => {
    setPhase("intro");
    setIdx(0);
    setAnswers({});
    setResult(null);
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setTimeout(reset, 200);
    }
    onOpenChange(v);
  };

  const begin = () => {
    setStartedAt(Date.now());
    setPhase("question");
  };

  const setAnswer = (qid: string, choiceId: string, kind: QuizQuestion["kind"]) => {
    setAnswers((prev) => {
      const cur = new Set(prev[qid] ?? []);
      if (kind === "multi") {
        if (cur.has(choiceId)) cur.delete(choiceId);
        else cur.add(choiceId);
      } else {
        cur.clear();
        cur.add(choiceId);
      }
      return { ...prev, [qid]: Array.from(cur) };
    });
  };

  const allAnswered = quiz.questions.every(
    (q) => (answers[q.id]?.length ?? 0) > 0
  );

  const submit = () => {
    start(async () => {
      const r = await submitQuizAction({
        quizSetId: quiz.id,
        answers,
        durationMs: Date.now() - startedAt,
      });
      const payload: ResultPayload = {
        score: r.score,
        passed: r.passed,
        correctCount: r.correctCount,
        totalCount: r.totalCount,
        attemptId: r.attemptId,
        failedModule: r.failedModule,
        programSlug: quiz.programSlug,
      };
      setResult(payload);
      setPhase("result");
      onCompleted?.(payload);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold">
              {quiz.title}
            </DialogTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {phase === "result"
                ? "Résultats"
                : phase === "intro"
                  ? `${total} question${total > 1 ? "s" : ""} · score à atteindre ≥ ${quiz.passThreshold}%`
                  : `Question ${idx + 1} sur ${total}`}
            </p>
          </div>
          <button
            onClick={() => handleOpenChange(false)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {phase === "intro" && (
          <IntroView
            quiz={quiz}
            onStart={begin}
          />
        )}
        {phase === "question" && current && (
          <QuestionView
            question={current}
            selected={answers[current.id] ?? []}
            onSelect={(choiceId) => setAnswer(current.id, choiceId, current.kind)}
          />
        )}
        {phase === "result" && result && (
          <ResultView quiz={quiz} answers={answers} result={result} onRetry={reset} />
        )}

        {phase === "question" && (
          <div className="flex items-center justify-between border-t border-border bg-surface-muted/30 px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Précédent
            </Button>
            <Progress current={idx + 1} total={total} />
            {idx < total - 1 ? (
              <Button
                size="sm"
                onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                disabled={(answers[current.id]?.length ?? 0) === 0}
              >
                Suivant <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={submit}
                disabled={!allAnswered || pending}
              >
                {pending ? "Validation…" : "Valider mes réponses"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="tabular-nums">
        {current}/{total}
      </span>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function IntroView({
  quiz,
  onStart,
}: {
  quiz: QuizSetWithQuestions;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <p className="text-sm text-foreground">
        Ce quiz comporte <strong>{quiz.questions.length} question(s)</strong>.
        Pour valider, atteignez <strong>{quiz.passThreshold}%</strong> de bonnes
        réponses.
      </p>
      <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <li>· Vous pouvez naviguer entre les questions avant de valider.</li>
        <li>· Une explication est fournie à la fin pour chaque question.</li>
        <li>· Vous pourrez repasser le quiz autant de fois que nécessaire.</li>
      </ul>
      <div className="flex justify-end pt-2">
        <Button size="sm" onClick={onStart}>
          Démarrer le quiz
        </Button>
      </div>
    </div>
  );
}

function QuestionView({
  question,
  selected,
  onSelect,
}: {
  question: QuizQuestion;
  selected: string[];
  onSelect: (id: string) => void;
}) {
  const isMulti = question.kind === "multi";
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <p className="text-sm font-medium leading-relaxed text-foreground">
        {question.prompt}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {isMulti
          ? "Plusieurs réponses possibles"
          : question.kind === "boolean"
            ? "Vrai ou faux"
            : "Une seule réponse"}
      </p>
      <ul className="flex flex-col gap-2">
        {question.choices.map((c) => {
          const isSelected = selected.includes(c.id);
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-all",
                  isSelected
                    ? "border-brand bg-brand/5 text-foreground"
                    : "border-border bg-white hover:border-brand/40 hover:bg-surface-muted/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-semibold",
                    isMulti ? "rounded-sm" : "rounded-full",
                    isSelected
                      ? "border-brand bg-brand text-white"
                      : "border border-border bg-white text-muted-foreground"
                  )}
                  style={{ borderWidth: 1 }}
                >
                  {isSelected ? "✓" : c.id.toUpperCase()}
                </span>
                <span className="flex-1 leading-snug">{c.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultView({
  quiz,
  answers,
  result,
  onRetry,
}: {
  quiz: QuizSetWithQuestions;
  answers: Record<string, string[]>;
  result: ResultPayload;
  onRetry: () => void;
}) {
  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-5">
      <ScoreBanner result={result} />
      {!result.passed && result.failedModule != null && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            Vos lacunes pointent vers le module {result.failedModule}.{" "}
            <Link
              href={`/catalogue/${result.programSlug}#module-${result.failedModule}`}
              className="font-semibold underline-offset-2 hover:underline"
            >
              Ouvrir maintenant
            </Link>
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {quiz.questions.map((q, i) => {
          const given = answers[q.id] ?? [];
          const expected = q.correctIds;
          const ok =
            given.length === expected.length &&
            given.every((id) => expected.includes(id));
          return (
            <li
              key={q.id}
              className="rounded-md border border-border bg-white px-3 py-3"
            >
              <div className="flex items-start gap-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug text-foreground">
                    {i + 1}. {q.prompt}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1 text-xs">
                    {q.choices.map((c) => {
                      const isGiven = given.includes(c.id);
                      const isCorrect = expected.includes(c.id);
                      const tone = isCorrect
                        ? "text-emerald-700"
                        : isGiven
                          ? "text-red-700"
                          : "text-muted-foreground";
                      return (
                        <li key={c.id} className={tone}>
                          <span className="font-mono text-[10px] uppercase">
                            {isCorrect ? "✓" : isGiven ? "✗" : " "}
                          </span>{" "}
                          {c.label}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 rounded bg-surface-muted/50 px-2 py-1.5 text-xs text-foreground">
                    <strong className="text-foreground">Explication.</strong>{" "}
                    {q.explanation}
                  </p>
                  {!ok && (
                    <ExplainAILink questionId={q.id} given={given} />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-white pt-3">
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RotateCcw className="mr-1 h-4 w-4" /> Repasser le quiz
        </Button>
      </div>
    </div>
  );
}

function ScoreBanner({ result }: { result: ResultPayload }) {
  const tone = result.passed
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-4 py-3",
        tone
      )}
    >
      <div className="flex items-center gap-3">
        {result.passed ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : (
          <XCircle className="h-6 w-6" />
        )}
        <div>
          <p className="text-sm font-semibold">
            {result.passed ? "Quiz validé" : "Quiz non validé"}
          </p>
          <p className="text-xs opacity-80">
            {result.correctCount} bonnes réponses sur {result.totalCount}
          </p>
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums">{result.score}%</p>
    </div>
  );
}

function ExplainAILink({
  questionId,
  given,
}: {
  questionId: string;
  given: string[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchExplanation = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setText("");
    try {
      const r = await fetch("/api/quiz-explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, given }),
      });
      if (!r.body) {
        setText("Impossible de générer l'explication.");
        setLoading(false);
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
    } catch {
      setText("Impossible de générer l'explication.");
    } finally {
      setLoading(false);
    }
  }, [questionId, given]);

  if (!open) {
    return (
      <button
        onClick={fetchExplanation}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-dark"
      >
        <Sparkles className="h-3 w-3" /> Comprendre cette question
      </button>
    );
  }
  return (
    <div className="mt-2 rounded border border-violet-200 bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
        <Sparkles className="h-3 w-3" />
        IA Coach
      </div>
      <p className="mt-1 leading-snug">
        {text || (loading ? "Réflexion en cours…" : "—")}
      </p>
    </div>
  );
}
