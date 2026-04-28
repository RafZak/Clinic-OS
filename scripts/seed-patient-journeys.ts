import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import {
  centers,
  practitioners,
  patients,
  sessions,
  sessionScores,
  coachingInsights,
  patientEvents,
} from "../db/schema";

config({ path: ".env.local" });

const ASSISTANT_FULL_NAME = "Sophie Bernard";
const TODAY_ANCHOR = new Date("2026-04-25T10:00:00Z");

function daysAgo(d: number): Date {
  const date = new Date(TODAY_ANCHOR);
  date.setUTCDate(date.getUTCDate() - d);
  return date;
}

type PhoneCallSeed = {
  durationSeconds: number;
  globalScore: number;
  summary: string;
  insights: {
    type: "good_practice" | "improvement" | "missed_objection" | "upsell_missed";
    severity: "info" | "warning" | "critical";
    title: string;
    description: string;
  }[];
};

type EventSeed = {
  daysAgo: number;
  summary: string;
  metadata: Record<string, unknown>;
} & (
  | { kind: "phone_call"; phone: PhoneCallSeed }
  | { kind: "appointment_scheduled" }
  | {
      kind: "consultation";
      consultationSlug:
        | "durand-excellent"
        | "martin-upsell-rate"
        | "lefevre-objection-price";
    }
  | { kind: "trial_start" }
  | { kind: "delivery" }
  | { kind: "follow_up" }
);

type JourneySeed = {
  patientLabel: string;
  status: "prospect" | "patient" | "lost";
  consultationSlug:
    | "durand-excellent"
    | "martin-upsell-rate"
    | "lefevre-objection-price";
  events: EventSeed[];
};

const JOURNEYS: JourneySeed[] = [
  {
    patientLabel: "Mme Françoise Durand",
    status: "patient",
    consultationSlug: "durand-excellent",
    events: [
      {
        kind: "phone_call",
        daysAgo: 30,
        summary: "Appel entrant — demande d'information suite à recommandation ORL.",
        metadata: { outcome: "rdv_pris", caller_role: "assistant" },
        phone: {
          durationSeconds: 142,
          globalScore: 82,
          summary:
            "Appel entrant bien géré : besoin identifié, RDV pris à 7 jours, ordonnance ORL confirmée.",
          insights: [
            {
              type: "good_practice",
              severity: "info",
              title: "Validation de l'ordonnance ORL",
              description:
                "L'assistante a reformulé la prescription pour rassurer la patiente avant de proposer le créneau.",
            },
          ],
        },
      },
      {
        kind: "appointment_scheduled",
        daysAgo: 30,
        summary: "RDV bilan auditif fixé avec Jonathan Goldminc.",
        metadata: {
          scheduled_for: "2026-04-04T14:00:00Z",
          duration_minutes: 60,
        },
      },
      {
        kind: "consultation",
        daysAgo: 21,
        consultationSlug: "durand-excellent",
        summary:
          "Consultation bilan + démonstration. Score 84/100. Recommandation classe 2.",
        metadata: { source: "replay-seed" },
      },
      {
        kind: "trial_start",
        daysAgo: 21,
        summary: "Essai 30 jours — Phonak Audéo Lumity P90 (classe 2).",
        metadata: {
          product: "Phonak Audéo Lumity P90",
          class: 2,
          price_eur: 3200,
          trial_days: 30,
        },
      },
      {
        kind: "delivery",
        daysAgo: 2,
        summary: "Livraison + adaptation finale. Patiente conquise.",
        metadata: {
          product: "Phonak Audéo Lumity P90",
          class: 2,
          price_eur: 3200,
          paid_eur: 3200,
          financing: "comptant",
        },
      },
      {
        kind: "follow_up",
        daysAgo: 0,
        summary:
          "Rappel téléphonique J+2 livraison — patiente très satisfaite, aucun besoin technique.",
        metadata: { channel: "telephone", duration_min: 8 },
      },
    ],
  },
  {
    patientLabel: "M. Henri Martin",
    status: "prospect",
    consultationSlug: "martin-upsell-rate",
    events: [
      {
        kind: "phone_call",
        daysAgo: 15,
        summary: "Appel entrant — souhaite renouveler son appareillage actuel.",
        metadata: { outcome: "rdv_pris", caller_role: "assistant" },
        phone: {
          durationSeconds: 96,
          globalScore: 75,
          summary:
            "RDV pris rapidement, motif renouvellement identifié. Profil potentiel de montée en gamme à briefer au pro.",
          insights: [
            {
              type: "improvement",
              severity: "info",
              title: "Pas de question sur les usages quotidiens",
              description:
                "L'assistante n'a pas creusé TV, restaurants, conduite — info utile pour la consultation suivante.",
            },
          ],
        },
      },
      {
        kind: "appointment_scheduled",
        daysAgo: 15,
        summary: "RDV bilan + recommandation fixé avec Jonathan Goldminc.",
        metadata: {
          scheduled_for: "2026-04-18T10:00:00Z",
          duration_minutes: 60,
        },
      },
      {
        kind: "consultation",
        daysAgo: 7,
        consultationSlug: "martin-upsell-rate",
        summary:
          "Consultation menée mais montée en gamme classe 2 non proposée. Score 52/100.",
        metadata: { source: "replay-seed", upsell_missed: true },
      },
      {
        kind: "trial_start",
        daysAgo: 7,
        summary:
          "Essai 30 jours — Signia Pure Charge&Go IX 3 (classe 1, 100% santé).",
        metadata: {
          product: "Signia Pure Charge&Go IX 3",
          class: 1,
          price_eur: 1800,
          trial_days: 30,
          upsell_missed: true,
        },
      },
    ],
  },
  {
    patientLabel: "Mme Isabelle Lefèvre",
    status: "lost",
    consultationSlug: "lefevre-objection-price",
    events: [
      {
        kind: "phone_call",
        daysAgo: 10,
        summary: "Appel entrant — premier contact, sceptique sur le prix.",
        metadata: { outcome: "rdv_pris", caller_role: "assistant" },
        phone: {
          durationSeconds: 108,
          globalScore: 68,
          summary:
            "Objection prix initiale gérée moyennement. RDV obtenu mais signal de risque transmis au pro.",
          insights: [
            {
              type: "improvement",
              severity: "warning",
              title: "Objection prix au téléphone non rebondie",
              description:
                "L'assistante a éludé la question financière sans valoriser le 100% santé ni le reste à charge.",
            },
          ],
        },
      },
      {
        kind: "appointment_scheduled",
        daysAgo: 10,
        summary: "RDV bilan fixé avec Jonathan Goldminc.",
        metadata: {
          scheduled_for: "2026-04-22T16:00:00Z",
          duration_minutes: 60,
        },
      },
      {
        kind: "consultation",
        daysAgo: 3,
        consultationSlug: "lefevre-objection-price",
        summary:
          "Objection prix non traitée en consultation. Patiente partie sans essai. Score 19/100.",
        metadata: {
          source: "replay-seed",
          lost_reason: "objection_prix_non_traitee",
        },
      },
    ],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("→ Seed parcours patients (J9)");

  const [center] = await db
    .select()
    .from(centers)
    .where(eq(centers.name, "Lyon 3"));
  if (!center) {
    throw new Error("Centre Lyon 3 absent — exécuter pnpm seed:replay d'abord");
  }

  const [claire] = await db
    .select()
    .from(practitioners)
    .where(
      and(
        eq(practitioners.fullName, "Jonathan Goldminc"),
        eq(practitioners.centerId, center.id)
      )
    );
  if (!claire) {
    throw new Error(
      "Audioprothésiste Jonathan Goldminc absente — exécuter pnpm seed:replay d'abord"
    );
  }

  let assistantRow = (
    await db
      .select()
      .from(practitioners)
      .where(
        and(
          eq(practitioners.fullName, ASSISTANT_FULL_NAME),
          eq(practitioners.centerId, center.id)
        )
      )
  )[0];
  if (!assistantRow) {
    [assistantRow] = await db
      .insert(practitioners)
      .values({
        fullName: ASSISTANT_FULL_NAME,
        role: "assistant",
        centerId: center.id,
      })
      .returning();
    console.log(
      `  assistant: ${assistantRow.fullName} (${assistantRow.id}) [créé]`
    );
  } else {
    console.log(`  assistant: ${assistantRow.fullName} (${assistantRow.id})`);
  }

  for (const journey of JOURNEYS) {
    console.log(`\n→ ${journey.patientLabel}`);

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.label, journey.patientLabel));
    if (!patient) {
      throw new Error(
        `Patient ${journey.patientLabel} absent — exécuter pnpm seed:replay d'abord`
      );
    }

    const earliestDaysAgo = journey.events.reduce(
      (max, e) => (e.daysAgo > max ? e.daysAgo : max),
      0
    );
    await db
      .update(patients)
      .set({
        status: journey.status,
        firstContactAt: daysAgo(earliestDaysAgo),
      })
      .where(eq(patients.id, patient.id));

    const previousEvents = await db
      .select({
        id: patientEvents.id,
        sessionId: patientEvents.sessionId,
        kind: patientEvents.kind,
      })
      .from(patientEvents)
      .where(eq(patientEvents.patientId, patient.id));

    const phoneSessionIds = previousEvents
      .filter((e) => e.kind === "phone_call" && e.sessionId)
      .map((e) => e.sessionId!) as string[];

    await db
      .delete(patientEvents)
      .where(eq(patientEvents.patientId, patient.id));

    for (const sid of phoneSessionIds) {
      await db.delete(sessionScores).where(eq(sessionScores.sessionId, sid));
      await db
        .delete(coachingInsights)
        .where(eq(coachingInsights.sessionId, sid));
      await db.delete(sessions).where(eq(sessions.id, sid));
    }

    const [consultationSession] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.patientId, patient.id),
          eq(sessions.kind, "consultation"),
          eq(sessions.source, "replay")
        )
      );
    if (!consultationSession) {
      throw new Error(
        `Session consultation replay absente pour ${journey.patientLabel} — exécuter pnpm seed:replay d'abord`
      );
    }

    let inserted = 0;
    for (const ev of journey.events) {
      let sessionId: string | null = null;

      if (ev.kind === "phone_call") {
        const startedAt = daysAgo(ev.daysAgo);
        const endedAt = new Date(
          startedAt.getTime() + ev.phone.durationSeconds * 1000
        );
        const [phoneSession] = await db
          .insert(sessions)
          .values({
            kind: "phone_call",
            source: "seed",
            status: "completed",
            analysisStatus: "done",
            practitionerId: assistantRow.id,
            patientId: patient.id,
            durationSeconds: ev.phone.durationSeconds,
            globalScore: ev.phone.globalScore,
            summary: ev.phone.summary,
            startedAt,
            endedAt,
            analyzedAt: endedAt,
          })
          .returning();
        sessionId = phoneSession.id;

        for (const ins of ev.phone.insights) {
          await db.insert(coachingInsights).values({
            sessionId,
            type: ins.type,
            severity: ins.severity,
            title: ins.title,
            description: ins.description,
          });
        }
      } else if (ev.kind === "consultation") {
        if (ev.consultationSlug !== journey.consultationSlug) {
          throw new Error(
            `Mismatch consultationSlug ${ev.consultationSlug} ↔ journey ${journey.patientLabel}`
          );
        }
        sessionId = consultationSession.id;
        const startedAt = daysAgo(ev.daysAgo);
        const endedAt = consultationSession.durationSeconds
          ? new Date(
              startedAt.getTime() +
                consultationSession.durationSeconds * 1000
            )
          : null;
        await db
          .update(sessions)
          .set({
            startedAt,
            endedAt,
            analyzedAt: endedAt ?? startedAt,
          })
          .where(eq(sessions.id, consultationSession.id));
      }

      await db.insert(patientEvents).values({
        patientId: patient.id,
        kind: ev.kind,
        sessionId,
        occurredAt: daysAgo(ev.daysAgo),
        summary: ev.summary,
        metadata: ev.metadata,
      });
      inserted++;
    }
    console.log(`  ${inserted} events insérés (status=${journey.status})`);
  }

  await client.end();
  console.log("\n✓ Parcours patients seedés.");
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
