import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { and, eq } from "drizzle-orm";

(async () => {
  const { db } = await import("../db/client");
  const { practitioners, practitionerCareSnapshots } = await import(
    "../db/schema"
  );

  const [jonathan] = await db
    .select({ centerId: practitioners.centerId })
    .from(practitioners)
    .where(eq(practitioners.fullName, "Jonathan Goldminc"))
    .limit(1);
  if (!jonathan?.centerId) {
    console.error("Jonathan / centre introuvable — lance d'abord les seeds de base.");
    process.exit(1);
  }
  const centerId = jonathan.centerId;

  const TEAM: Array<{
    name: string;
    scores: [number, number, number, number, number, number];
  }> = [
    { name: "Camille Roche", scores: [82, 64, 58, 71, 88, 55] },
    { name: "Marc Lefèvre", scores: [70, 80, 66, 62, 74, 68] },
    { name: "Inès Khelifi", scores: [90, 72, 49, 84, 60, 77] },
  ];

  for (const t of TEAM) {
    let [pro] = await db
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(
        and(
          eq(practitioners.fullName, t.name),
          eq(practitioners.role, "audioprothesiste")
        )
      )
      .limit(1);
    if (!pro) {
      [pro] = await db
        .insert(practitioners)
        .values({ fullName: t.name, role: "audioprothesiste", centerId })
        .returning({ id: practitioners.id });
    }

    const [r, p, s, g, f, a] = t.scores;
    const vals = {
      practitionerId: pro.id,
      rapportScore: r,
      pedagogyScore: p,
      structureScore: s,
      guidanceScore: g,
      followThroughScore: f,
      adaptabilityScore: a,
      rationale: null,
      source: "seed",
      sessionsCount: 0,
      model: null,
      promptVersion: null,
      rawOutput: null,
    } as typeof practitionerCareSnapshots.$inferInsert;

    await db
      .insert(practitionerCareSnapshots)
      .values(vals)
      .onConflictDoUpdate({
        target: practitionerCareSnapshots.practitionerId,
        set: vals,
      });
    console.log(`seed ${t.name} ✓`);
  }

  console.log(`\n${TEAM.length} praticiens fictifs seedés (centre ${centerId.slice(0, 8)}).`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
