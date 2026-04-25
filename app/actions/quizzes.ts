"use server";

import { db } from "@/db/client";
import { quizAttempts, vaultPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getRole } from "@/lib/role";
import { getCurrentQuizPractitioner } from "@/lib/quiz-identity";
import {
  getQuizSetWithQuestions,
  gradeAttempt,
  type QuizSetWithQuestions,
} from "@/lib/quizzes";
import { readVaultFile, writeVaultFile } from "@/lib/vault/storage";
import { slugify } from "@/lib/vault/ingest";

export type SubmitQuizResult = {
  attemptId: string;
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  failedModule: number | null;
};

export async function loadQuizSetAction(
  quizSetId: string
): Promise<QuizSetWithQuestions | null> {
  return getQuizSetWithQuestions(quizSetId);
}

export async function submitQuizAction(input: {
  quizSetId: string;
  answers: Record<string, string[]>;
  durationMs?: number;
}): Promise<SubmitQuizResult> {
  const role = await getRole();
  const practitioner = await getCurrentQuizPractitioner(role);
  if (!practitioner) {
    throw new Error("Aucun practitioner pour ce rôle");
  }

  const quiz = await getQuizSetWithQuestions(input.quizSetId);
  if (!quiz) {
    throw new Error("Quiz introuvable");
  }

  const grade = gradeAttempt(quiz.questions, input.answers, quiz.passThreshold);

  const [inserted] = await db
    .insert(quizAttempts)
    .values({
      quizSetId: quiz.id,
      practitionerId: practitioner.id,
      score: grade.score,
      passed: grade.passed,
      answers: input.answers,
      durationMs: input.durationMs ?? null,
    })
    .returning({ id: quizAttempts.id });

  let failedModule: number | null = null;
  if (!grade.passed) {
    const counts = new Map<number, number>();
    for (const q of quiz.questions) {
      const given = new Set(input.answers[q.id] ?? []);
      const expected = new Set(q.correctIds);
      const ok =
        given.size === expected.size &&
        Array.from(expected).every((id) => given.has(id));
      if (!ok && q.relatedModule != null) {
        counts.set(q.relatedModule, (counts.get(q.relatedModule) ?? 0) + 1);
      }
    }
    if (counts.size > 0) {
      failedModule = Array.from(counts.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0][0];
    } else if (quiz.moduleNumber != null) {
      failedModule = quiz.moduleNumber;
    }
  }

  if (grade.passed) {
    try {
      await appendKarpathyFormation({
        practitionerName: practitioner.fullName,
        quizTitle: quiz.title,
        score: grade.score,
        programSlug: quiz.programSlug,
      });
    } catch (e) {
      console.warn("vault append (formation) failed", e);
    }
  }

  revalidatePath(`/catalogue/${quiz.programSlug}`);

  return {
    attemptId: inserted.id,
    score: grade.score,
    passed: grade.passed,
    correctCount: grade.correctCount,
    totalCount: quiz.questions.length,
    failedModule,
  };
}

async function appendKarpathyFormation(args: {
  practitionerName: string;
  quizTitle: string;
  score: number;
  programSlug: string;
}): Promise<void> {
  const slug = slugify(args.practitionerName);
  const path = `practitioners/${slug}.md`;
  const existing = await readVaultFile(path);
  if (!existing) return;

  const today = new Date().toISOString().slice(0, 10);
  const line = `- ✓ ${args.quizTitle} validé le ${today} (${args.score}%) — programme [[${args.programSlug}]]`;

  let updated: string;
  if (existing.includes("## Formation")) {
    if (existing.includes(line)) {
      return;
    }
    updated = existing.replace(/(## Formation\n)/, `$1${line}\n`);
  } else {
    const trimmed = existing.replace(/\s*$/, "");
    updated = `${trimmed}\n\n## Formation\n${line}\n`;
  }

  await writeVaultFile(path, updated);

  await db
    .update(vaultPages)
    .set({ contentMd: updated, updatedAt: new Date() })
    .where(eq(vaultPages.path, path));
}
