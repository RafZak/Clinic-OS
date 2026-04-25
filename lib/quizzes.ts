import "server-only";
import { db } from "@/db/client";
import { quizSets, quizQuestions, quizAttempts } from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export type QuizChoice = { id: string; label: string };
export type QuizKind = "single" | "multi" | "boolean";

export type QuizQuestion = {
  id: string;
  position: number;
  prompt: string;
  kind: QuizKind;
  choices: QuizChoice[];
  correctIds: string[];
  explanation: string;
  relatedModule: number | null;
};

export type QuizSet = {
  id: string;
  programSlug: string;
  moduleNumber: number | null;
  ordinal: number;
  title: string;
  passThreshold: number;
  sourceFile: string;
};

export type QuizSetWithQuestions = QuizSet & {
  questions: QuizQuestion[];
};

export type QuizAttemptSummary = {
  id: string;
  quizSetId: string;
  score: number;
  passed: boolean;
  completedAt: Date | null;
};

export async function listQuizSetsForProgram(
  programSlug: string
): Promise<QuizSet[]> {
  const rows = await db
    .select()
    .from(quizSets)
    .where(eq(quizSets.programSlug, programSlug))
    .orderBy(asc(quizSets.ordinal));
  return rows.map((r) => ({
    id: r.id,
    programSlug: r.programSlug,
    moduleNumber: r.moduleNumber,
    ordinal: r.ordinal,
    title: r.title,
    passThreshold: r.passThreshold,
    sourceFile: r.sourceFile,
  }));
}

export async function getQuizSetWithQuestions(
  id: string
): Promise<QuizSetWithQuestions | null> {
  const [set] = await db
    .select()
    .from(quizSets)
    .where(eq(quizSets.id, id))
    .limit(1);
  if (!set) return null;

  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizSetId, id))
    .orderBy(asc(quizQuestions.position));

  return {
    id: set.id,
    programSlug: set.programSlug,
    moduleNumber: set.moduleNumber,
    ordinal: set.ordinal,
    title: set.title,
    passThreshold: set.passThreshold,
    sourceFile: set.sourceFile,
    questions: qs.map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      kind: q.kind as QuizKind,
      choices: q.choices as QuizChoice[],
      correctIds: q.correctIds as string[],
      explanation: q.explanation,
      relatedModule: q.relatedModule,
    })),
  };
}

export async function getQuizQuestion(
  questionId: string
): Promise<{ question: QuizQuestion; set: QuizSet } | null> {
  const [row] = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1);
  if (!row) return null;
  const [set] = await db
    .select()
    .from(quizSets)
    .where(eq(quizSets.id, row.quizSetId))
    .limit(1);
  if (!set) return null;
  return {
    question: {
      id: row.id,
      position: row.position,
      prompt: row.prompt,
      kind: row.kind as QuizKind,
      choices: row.choices as QuizChoice[],
      correctIds: row.correctIds as string[],
      explanation: row.explanation,
      relatedModule: row.relatedModule,
    },
    set: {
      id: set.id,
      programSlug: set.programSlug,
      moduleNumber: set.moduleNumber,
      ordinal: set.ordinal,
      title: set.title,
      passThreshold: set.passThreshold,
      sourceFile: set.sourceFile,
    },
  };
}

export async function getBestAttemptsByPractitioner(
  practitionerId: string,
  quizSetIds: string[]
): Promise<Map<string, QuizAttemptSummary>> {
  const map = new Map<string, QuizAttemptSummary>();
  if (quizSetIds.length === 0) return map;
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.practitionerId, practitionerId),
        inArray(quizAttempts.quizSetId, quizSetIds)
      )
    )
    .orderBy(desc(quizAttempts.score), desc(quizAttempts.completedAt));
  for (const r of rows) {
    const existing = map.get(r.quizSetId);
    if (!existing || r.score > existing.score) {
      map.set(r.quizSetId, {
        id: r.id,
        quizSetId: r.quizSetId,
        score: r.score,
        passed: r.passed,
        completedAt: r.completedAt,
      });
    }
  }
  return map;
}

export function gradeAttempt(
  questions: QuizQuestion[],
  answers: Record<string, string[]>,
  passThreshold = 80
): { score: number; passed: boolean; correctCount: number } {
  if (questions.length === 0) {
    return { score: 0, passed: false, correctCount: 0 };
  }
  let correct = 0;
  for (const q of questions) {
    const given = new Set(answers[q.id] ?? []);
    const expected = new Set(q.correctIds);
    if (given.size !== expected.size) continue;
    let same = true;
    for (const id of expected) {
      if (!given.has(id)) {
        same = false;
        break;
      }
    }
    if (same) correct++;
  }
  const score = Math.round((correct / questions.length) * 100);
  return { score, passed: score >= passThreshold, correctCount: correct };
}
