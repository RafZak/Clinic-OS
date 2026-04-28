import "server-only";
import { db } from "@/db/client";
import { practitioners } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Role } from "./role";

const DEFAULT_BY_ROLE: Record<Role, string> = {
  audioprothesiste: "Jonathan Goldminc",
  assistant: "Sophie Bernard",
};

export type QuizPractitioner = {
  id: string;
  fullName: string;
  role: Role;
};

export async function getCurrentQuizPractitioner(
  role: Role
): Promise<QuizPractitioner | null> {
  const preferred = DEFAULT_BY_ROLE[role];

  const [byName] = await db
    .select({ id: practitioners.id, fullName: practitioners.fullName })
    .from(practitioners)
    .where(
      and(eq(practitioners.role, role), eq(practitioners.fullName, preferred))
    )
    .limit(1);
  if (byName) return { id: byName.id, fullName: byName.fullName, role };

  const [fallback] = await db
    .select({ id: practitioners.id, fullName: practitioners.fullName })
    .from(practitioners)
    .where(eq(practitioners.role, role))
    .orderBy(asc(practitioners.createdAt))
    .limit(1);
  if (fallback) return { id: fallback.id, fullName: fallback.fullName, role };

  return null;
}
