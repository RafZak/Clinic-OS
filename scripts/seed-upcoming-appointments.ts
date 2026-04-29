import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, sql } from "drizzle-orm";
import {
  centers,
  practitioners,
  patients,
  patientEvents,
} from "../db/schema";

config({ path: ".env.local" });

const SEED_TAG = "upcoming-demo";

type ExistingAppointment = {
  patientLabel: string;
  daysAhead: number;
  hour: number;
  minute: number;
  durationMinutes: number;
  summary: string;
};

type NewProspectAppointment = {
  patientLabel: string;
  age: number;
  daysAhead: number;
  hour: number;
  minute: number;
  durationMinutes: number;
  summary: string;
};

const EXISTING_PATIENT_APPOINTMENTS: ExistingAppointment[] = [
  {
    patientLabel: "M. Henri Martin",
    daysAhead: 5,
    hour: 10,
    minute: 30,
    durationMinutes: 45,
    summary: "Bilan de fin d'essai — décision finale classe 1 vs classe 2.",
  },
  {
    patientLabel: "Mme Françoise Durand",
    daysAhead: 18,
    hour: 14,
    minute: 0,
    durationMinutes: 30,
    summary: "Contrôle 3 semaines — adaptation et nettoyage.",
  },
];

const NEW_PROSPECT_APPOINTMENTS: NewProspectAppointment[] = [
  {
    patientLabel: "M. Patrick Vidal",
    age: 68,
    daysAhead: 2,
    hour: 9,
    minute: 0,
    durationMinutes: 60,
    summary: "Premier bilan auditif — recommandation ORL Dr Lambert.",
  },
  {
    patientLabel: "Mme Sylvie Caron",
    age: 72,
    daysAhead: 2,
    hour: 11,
    minute: 30,
    durationMinutes: 60,
    summary: "Bilan complet — gêne en environnement bruyant signalée.",
  },
  {
    patientLabel: "M. Bernard Roux",
    age: 64,
    daysAhead: 8,
    hour: 16,
    minute: 0,
    durationMinutes: 60,
    summary: "Premier RDV — renouvellement (anciens appareils 2018).",
  },
  {
    patientLabel: "Mme Catherine Mercier",
    age: 59,
    daysAhead: 12,
    hour: 10,
    minute: 0,
    durationMinutes: 60,
    summary: "Bilan auditif — accompagne sa mère, dépistage demandé.",
  },
  {
    patientLabel: "M. Alain Dubreuil",
    age: 75,
    daysAhead: 12,
    hour: 15,
    minute: 30,
    durationMinutes: 60,
    summary: "Bilan + démonstration — orienté par sa pharmacie.",
  },
  {
    patientLabel: "Mme Nicole Petit",
    age: 70,
    daysAhead: 22,
    hour: 14,
    minute: 30,
    durationMinutes: 60,
    summary: "Prospect chaud — campagne 100 % santé.",
  },
];

function dateAtUTC(daysAhead: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("→ Seed RDV futurs (mini-calendrier dashboard)");

  const [center] = await db
    .select()
    .from(centers)
    .where(eq(centers.name, "Lyon 3"));
  if (!center) {
    throw new Error("Centre Lyon 3 absent — exécuter pnpm seed:replay d'abord");
  }

  const [pro] = await db
    .select()
    .from(practitioners)
    .where(
      and(
        eq(practitioners.fullName, "Jonathan Goldminc"),
        eq(practitioners.centerId, center.id)
      )
    );
  if (!pro) {
    throw new Error(
      "Audioprothésiste Jonathan Goldminc absent — exécuter pnpm seed:replay d'abord"
    );
  }

  const deleted = await db
    .delete(patientEvents)
    .where(sql`${patientEvents.metadata}->>'seed_tag' = ${SEED_TAG}`)
    .returning({ id: patientEvents.id });
  console.log(`  ${deleted.length} RDV démo précédents nettoyés`);

  const previousProspects = await db
    .select({ id: patients.id, label: patients.label })
    .from(patients)
    .where(sql`${patients.label} = ANY(${sql.raw(
      `ARRAY[${NEW_PROSPECT_APPOINTMENTS.map(
        (p) => `'${p.patientLabel.replace(/'/g, "''")}'`
      ).join(",")}]`
    )})`);
  const labelToId = new Map(previousProspects.map((p) => [p.label, p.id]));

  let inserted = 0;

  for (const apt of EXISTING_PATIENT_APPOINTMENTS) {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.label, apt.patientLabel));
    if (!patient) {
      console.warn(`  ! ${apt.patientLabel} introuvable — skip`);
      continue;
    }
    const scheduledFor = dateAtUTC(apt.daysAhead, apt.hour, apt.minute);
    await db.insert(patientEvents).values({
      patientId: patient.id,
      kind: "appointment_scheduled",
      occurredAt: scheduledFor,
      summary: apt.summary,
      metadata: {
        seed_tag: SEED_TAG,
        scheduled_for: scheduledFor.toISOString(),
        duration_minutes: apt.durationMinutes,
        practitioner_id: pro.id,
      },
    });
    inserted++;
    console.log(
      `  + ${apt.patientLabel} · ${scheduledFor.toISOString().slice(0, 16).replace("T", " ")}`
    );
  }

  for (const apt of NEW_PROSPECT_APPOINTMENTS) {
    let patientId = labelToId.get(apt.patientLabel);
    if (!patientId) {
      const [created] = await db
        .insert(patients)
        .values({
          label: apt.patientLabel,
          age: apt.age,
          status: "prospect",
          centerId: center.id,
          firstContactAt: new Date(),
        })
        .returning();
      patientId = created.id;
      labelToId.set(apt.patientLabel, patientId);
      console.log(`  +patient ${apt.patientLabel}`);
    }
    const scheduledFor = dateAtUTC(apt.daysAhead, apt.hour, apt.minute);
    await db.insert(patientEvents).values({
      patientId,
      kind: "appointment_scheduled",
      occurredAt: scheduledFor,
      summary: apt.summary,
      metadata: {
        seed_tag: SEED_TAG,
        scheduled_for: scheduledFor.toISOString(),
        duration_minutes: apt.durationMinutes,
        practitioner_id: pro.id,
      },
    });
    inserted++;
    console.log(
      `  + ${apt.patientLabel} · ${scheduledFor.toISOString().slice(0, 16).replace("T", " ")}`
    );
  }

  await client.end();
  console.log(`\n✓ ${inserted} RDV futurs seedés.`);
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
