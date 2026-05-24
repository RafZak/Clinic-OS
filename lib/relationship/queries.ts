import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientRelationshipSynthesis } from "@/db/schema";
import type { RelationshipSynthesis } from "./types";

export async function getRelationshipSynthesis(
  patientId: string
): Promise<RelationshipSynthesis | null> {
  const [row] = await db
    .select()
    .from(patientRelationshipSynthesis)
    .where(eq(patientRelationshipSynthesis.patientId, patientId))
    .limit(1);
  if (!row) return null;
  return {
    abstractMd: row.abstractMd,
    abstractMdEn: row.abstractMdEn,
    communicationStyle:
      row.communicationStyle as RelationshipSynthesis["communicationStyle"],
    setbacks: row.setbacks as RelationshipSynthesis["setbacks"],
    priorities: row.priorities as RelationshipSynthesis["priorities"],
    sessionsCount: row.sessionsCount,
    updatedAt: row.updatedAt,
  };
}
