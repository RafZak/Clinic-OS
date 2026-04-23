import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { programs } from "../db/schema";

config({ path: ".env.local" });

type ProgramSeed = {
  slug: string;
  title: string;
  description: string;
  category: "acquisition" | "points-de-contact" | "appareillage" | "fidelisation";
  icon: string;
  isAvailable: boolean;
  orderIdx: number;
};

export const PROGRAMS: ProgramSeed[] = [
  // 4 programmes actifs — correspondent aux dossiers Drive
  {
    slug: "reference",
    title: "Programme de Référence",
    description:
      "8 modules dédiés à la recommandation patient : transformer chaque contact en levier de croissance du centre. Le programme phare d'Audio Académie.",
    category: "acquisition",
    icon: "Star",
    isAvailable: true,
    orderIdx: 1,
  },
  {
    slug: "personnel-accueil",
    title: "Personnel d'accueil",
    description:
      "11 modules pour l'assistant accueil : premier contact patient, tenue du centre, gestion administrative, relations avec l'audioprothésiste.",
    category: "points-de-contact",
    icon: "Users",
    isAvailable: true,
    orderIdx: 2,
  },
  {
    slug: "convaincre-telephone",
    title: "Convaincre au téléphone",
    description:
      "7 modules pour transformer l'appel entrant en RDV. 80 % des opportunités naissent ou meurent ici.",
    category: "points-de-contact",
    icon: "Phone",
    isAvailable: true,
    orderIdx: 3,
  },
  {
    slug: "audio-vente",
    title: "Audioprothésiste face à la vente",
    description:
      "Les 10 étapes de la consultation d'audioprothèse maîtrisées : de la préparation au suivi, en passant par les objections et la recommandation.",
    category: "appareillage",
    icon: "Headphones",
    isAvailable: true,
    orderIdx: 4,
  },
  // 6 programmes "Bientôt disponible" — pour compléter le catalogue
  {
    slug: "management-centre",
    title: "Management d'équipe centre",
    description:
      "Piloter la performance collective, faire monter les juniors, gérer les tensions entre audioprothésiste et assistant.",
    category: "acquisition",
    icon: "Network",
    isAvailable: false,
    orderIdx: 5,
  },
  {
    slug: "onboarding",
    title: "Onboarding nouveau collaborateur",
    description:
      "Intégrer un audioprothésiste ou un assistant dans le centre en 90 jours : outils, repères culturels, premiers résultats.",
    category: "acquisition",
    icon: "UserPlus",
    isAvailable: false,
    orderIdx: 6,
  },
  {
    slug: "patient-difficile",
    title: "Communication patient difficile",
    description:
      "Patients réticents, anxieux, en refus d'appareillage. Outils pour créer l'alliance thérapeutique durable.",
    category: "points-de-contact",
    icon: "MessageCircle",
    isAvailable: false,
    orderIdx: 7,
  },
  {
    slug: "essai-appareillage",
    title: "L'essai appareillage",
    description:
      "Sécuriser la période d'essai, gérer les retours et transformer en achat. Le moment de vérité commercial.",
    category: "appareillage",
    icon: "Ear",
    isAvailable: false,
    orderIdx: 8,
  },
  {
    slug: "renouvellement",
    title: "Renouvellement et fidélisation",
    description:
      "Cycle de vie patient : renouveler, recommander, transformer l'expérience en bouche-à-oreille.",
    category: "fidelisation",
    icon: "Recycle",
    isAvailable: false,
    orderIdx: 9,
  },
  {
    slug: "suivi-long-terme",
    title: "Suivi patient appareillé",
    description:
      "Suivi à 1 mois, 6 mois, 1 an. Anticiper les changements auditifs pour garder le patient dans la durée.",
    category: "fidelisation",
    icon: "Calendar",
    isAvailable: false,
    orderIdx: 10,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log(`→ Upsert de ${PROGRAMS.length} programmes`);
  for (const prog of PROGRAMS) {
    await db
      .insert(programs)
      .values(prog)
      .onConflictDoUpdate({
        target: programs.slug,
        set: {
          title: prog.title,
          description: prog.description,
          category: prog.category,
          icon: prog.icon,
          isAvailable: prog.isAvailable,
          orderIdx: prog.orderIdx,
        },
      });
    const marker = prog.isAvailable ? "✓" : "○";
    console.log(`  ${marker} ${prog.slug.padEnd(22)} ${prog.title}`);
  }

  await client.end();
  console.log("\n✓ Programmes seedés.");
}

main().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
