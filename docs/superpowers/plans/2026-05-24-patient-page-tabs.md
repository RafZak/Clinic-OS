# Page patient — 4 onglets + Patient Insights dé-commercialisés — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructurer la page de détail patient en 4 onglets cliquables (Patient Journey · Patient Insights · Relationship Abstract · Relationship Detail) qui restent sur la même page, en remplaçant le radar « Profil psychologique » commercial par une vue Patient Insights en logique soin, **sans toucher au backend psychologie** (exports XLSX/CSV, recall list dashboard, liste patients, artefacts continuent de fonctionner).

**Architecture (Option A — périmètre contenu) :**
- La page reste un Server Component qui charge toutes les données, rend 4 sections et les passe en `ReactNode` à un nouveau Client Component `PatientTabs` (Radix Tabs déjà dispo) → pas de routing, on reste sur la page.
- **Patient Insights** = 5 jauges en barres calculées par **mapping d'affichage** du `globalRadar` psychologie existant (aucune migration, aucun re-score) + 3 blocs de tags (Communication / Setbacks / Priorities) produits par une **nouvelle synthèse IA additive** stockée par patient.
- **Relationship Abstract** = nouvelle synthèse IA (prose) stockée dans une nouvelle table `patient_relationship_synthesis`, pré-générée par script pour les patients de démo.
- **Relationship Detail** = fiche vault existante du patient rendue en entier dans l'onglet.
- **Patient Journey** = `PatientTimeline` existant déplacé dans l'onglet.

**Tech Stack :** Next.js 16 (App Router), TypeScript strict, Drizzle ORM (Postgres/Supabase), Radix Tabs (shadcn), react-markdown, next-intl (FR/EN), Anthropic SDK (`@/lib/claude`).

**Contraintes :**
- Démo Amplifon le **2026-05-26** → priorité : ne rien casser, fiabilité sur scène.
- **Pas de framework de tests** dans le projet. Vérification = `pnpm typecheck` + `pnpm lint` + dev server + non-régression manuelle + scripts CLI. Pas de TDD à tests rouges (volontaire, adapté au projet).
- **Ne pas modifier** : `lib/psychology/score-session.ts`, `lib/psychology/export/*`, `lib/psychology/queries.ts` (sauf lecture), `components/dashboard/recall-list.tsx`, `app/api/exports/patients/route.ts`, la table `session_psychology_snapshots`.

---

## File Structure

**Créés :**
- `lib/care-insights/dimensions.ts` — 5 dimensions soin + mapping depuis `PsyRadar` + libellés/copy FR-EN (pur, display-only).
- `lib/relationship/taxonomy.ts` — taxonomies fixes Communication / Setbacks / Priorities (clés + libellés FR-EN).
- `lib/relationship/prompt.ts` — construction du prompt de synthèse relationnelle.
- `lib/relationship/generate.ts` — `generateRelationshipSynthesis(patientId)` : appel Claude + upsert.
- `lib/relationship/queries.ts` — `getRelationshipSynthesis(patientId)` (lecture).
- `lib/relationship/types.ts` — types partagés (`RelationshipSynthesis`, blocs structurés).
- `components/patients/patient-tabs.tsx` — Client : coquille Radix Tabs, reçoit 4 `ReactNode`.
- `components/patients/patient-insights-view.tsx` — Client : 5 barres + panneau détail + 3 blocs de tags.
- `components/patients/relationship-abstract-view.tsx` — synthèse prose (markdown) + date.
- `scripts/relationship-generate.ts` — CLI de pré-génération pour patients de démo.

**Modifiés :**
- `db/schema.ts` — ajout table `patientRelationshipSynthesis`.
- `app/patients/[id]/page.tsx` — fetch synthèse + dimensions soin, rendu en 4 onglets.
- `messages/fr.json` + `messages/en.json` — namespaces `patientTabs`, `careInsights`, `relationship` ; reformulation des libellés contenant « profil psychologique » visibles sur la page patient.
- `package.json` — script `relationship:generate`.

---

## Task 1 — Table `patient_relationship_synthesis` (additive, ne casse rien)

**Files:**
- Modify: `db/schema.ts` (ajouter après le bloc `sessionPsychologySnapshots`, ~ligne 502)
- Generated: `db/migrations/*` via drizzle-kit

- [ ] **Step 1 : Ajouter la table dans le schéma**

Dans `db/schema.ts`, après la définition de `sessionPsychologySnapshots`, ajouter :

```ts
// ==================================================================
// 15quinquies. Synthèse relationnelle patient (1 par patient, IA, additive)
// Ne remplace PAS session_psychology_snapshots : sert la page patient
// (onglets Patient Insights tags + Relationship Abstract).
// ==================================================================
export const patientRelationshipSynthesis = pgTable(
  "patient_relationship_synthesis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    abstractMd: text("abstract_md").notNull(),
    // {lead: string|null, relevant: string[]}
    communicationStyle: jsonb("communication_style").notNull(),
    // {present: string[]}
    setbacks: jsonb("setbacks").notNull(),
    // {lead: string|null, relevant: string[]}
    priorities: jsonb("priorities").notNull(),
    sessionsCount: smallint("sessions_count").notNull().default(0),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    rawOutput: jsonb("raw_output").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("patient_relationship_synthesis_patient_unique").on(t.patientId)]
);
```

(`pgTable`, `uuid`, `text`, `jsonb`, `smallint`, `timestamp`, `unique` sont déjà importés en tête de `db/schema.ts`.)

- [ ] **Step 2 : Générer la migration**

Run: `pnpm db:generate`
Expected : un nouveau fichier SQL dans `db/migrations/` contenant `CREATE TABLE "patient_relationship_synthesis"`. Vérifier qu'**aucun** `DROP`/`ALTER` ne touche `session_psychology_snapshots` ni une autre table (sinon ne pas appliquer, revoir).

- [ ] **Step 3 : Appliquer la migration**

Run: `pnpm db:migrate`
Expected : succès, table créée.

- [ ] **Step 4 : Commit**

```bash
git add db/schema.ts db/migrations
git commit -m "feat(db): table patient_relationship_synthesis (additive)"
```

---

## Task 2 — Taxonomies & types relationship

**Files:**
- Create: `lib/relationship/taxonomy.ts`
- Create: `lib/relationship/types.ts`

- [ ] **Step 1 : Types partagés**

`lib/relationship/types.ts` :

```ts
export type CommunicationStyleKey =
  | "reassurance-led" | "evidence-led" | "story-led"
  | "visual-led" | "peer-led";

export type SetbackKey =
  | "cost-concern" | "fear-of-stigma" | "doubts-it-helps"
  | "past-bad-experience" | "not-ready-to-accept" | "comfort-worries"
  | "waiting-for-family" | "overwhelmed-by-options";

export type PriorityKey =
  | "sound-quality" | "social-life" | "discretion" | "budget-value"
  | "comfort" | "ease-of-use" | "phone-calls" | "tv-connectivity"
  | "battery-life" | "active-sport" | "tinnitus-relief" | "follow-up-service";

export type RelationshipSynthesis = {
  abstractMd: string;
  communicationStyle: { lead: CommunicationStyleKey | null; relevant: CommunicationStyleKey[] };
  setbacks: { present: SetbackKey[] };
  priorities: { lead: PriorityKey | null; relevant: PriorityKey[] };
  sessionsCount: number;
  updatedAt: Date;
};
```

- [ ] **Step 2 : Taxonomies + libellés FR/EN**

`lib/relationship/taxonomy.ts` :

```ts
import type { CommunicationStyleKey, SetbackKey, PriorityKey } from "./types";

export const COMMUNICATION_KEYS: CommunicationStyleKey[] = [
  "reassurance-led", "evidence-led", "story-led", "visual-led", "peer-led",
];
export const SETBACK_KEYS: SetbackKey[] = [
  "cost-concern", "fear-of-stigma", "doubts-it-helps", "past-bad-experience",
  "not-ready-to-accept", "comfort-worries", "waiting-for-family", "overwhelmed-by-options",
];
export const PRIORITY_KEYS: PriorityKey[] = [
  "sound-quality", "social-life", "discretion", "budget-value", "comfort",
  "ease-of-use", "phone-calls", "tv-connectivity", "battery-life",
  "active-sport", "tinnitus-relief", "follow-up-service",
];

const COMMUNICATION_LABEL_FR: Record<CommunicationStyleKey, string> = {
  "reassurance-led": "Besoin d'être rassuré", "evidence-led": "Sensible aux preuves",
  "story-led": "Sensible au vécu", "visual-led": "Démonstration visuelle", "peer-led": "Avis de pairs",
};
const COMMUNICATION_LABEL_EN: Record<CommunicationStyleKey, string> = {
  "reassurance-led": "Reassurance-led", "evidence-led": "Evidence-led",
  "story-led": "Story-led", "visual-led": "Visual / demo-led", "peer-led": "Peer-led",
};
const SETBACK_LABEL_FR: Record<SetbackKey, string> = {
  "cost-concern": "Frein budgétaire", "fear-of-stigma": "Peur du regard",
  "doubts-it-helps": "Doute sur l'efficacité", "past-bad-experience": "Mauvaise expérience passée",
  "not-ready-to-accept": "Pas prêt à accepter", "comfort-worries": "Crainte sur le confort",
  "waiting-for-family": "Attend l'avis des proches", "overwhelmed-by-options": "Submergé par les options",
};
const SETBACK_LABEL_EN: Record<SetbackKey, string> = {
  "cost-concern": "Cost concern", "fear-of-stigma": "Fear of stigma",
  "doubts-it-helps": "Doubts it will help", "past-bad-experience": "Past bad experience",
  "not-ready-to-accept": "Not ready to accept", "comfort-worries": "Comfort worries",
  "waiting-for-family": "Waiting for family input", "overwhelmed-by-options": "Overwhelmed by options",
};
const PRIORITY_LABEL_FR: Record<PriorityKey, string> = {
  "sound-quality": "Qualité sonore", "social-life": "Vie sociale", "discretion": "Discrétion",
  "budget-value": "Budget / valeur", "comfort": "Confort", "ease-of-use": "Simplicité d'usage",
  "phone-calls": "Téléphone & appels", "tv-connectivity": "TV & connectivité",
  "battery-life": "Autonomie", "active-sport": "Activité / sport",
  "tinnitus-relief": "Soulagement acouphènes", "follow-up-service": "Suivi & service",
};
const PRIORITY_LABEL_EN: Record<PriorityKey, string> = {
  "sound-quality": "Sound quality", "social-life": "Social life", "discretion": "Discretion",
  "budget-value": "Budget / value", "comfort": "Comfort", "ease-of-use": "Ease of use",
  "phone-calls": "Phone & calls", "tv-connectivity": "TV & connectivity",
  "battery-life": "Battery life", "active-sport": "Active / sport",
  "tinnitus-relief": "Tinnitus relief", "follow-up-service": "Follow-up & service",
};

export function communicationLabel(k: CommunicationStyleKey, locale: "fr" | "en") {
  return (locale === "en" ? COMMUNICATION_LABEL_EN : COMMUNICATION_LABEL_FR)[k];
}
export function setbackLabel(k: SetbackKey, locale: "fr" | "en") {
  return (locale === "en" ? SETBACK_LABEL_EN : SETBACK_LABEL_FR)[k];
}
export function priorityLabel(k: PriorityKey, locale: "fr" | "en") {
  return (locale === "en" ? PRIORITY_LABEL_EN : PRIORITY_LABEL_FR)[k];
}
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `pnpm typecheck`
Expected : PASS (pas d'erreur sur ces deux fichiers).

- [ ] **Step 4 : Commit**

```bash
git add lib/relationship/taxonomy.ts lib/relationship/types.ts
git commit -m "feat(relationship): taxonomies care + types synthèse patient"
```

---

## Task 3 — Mapping dimensions soin (display-only, depuis PsyRadar)

**Files:**
- Create: `lib/care-insights/dimensions.ts`

Mapping figé (aucune donnée commerciale exposée : `priceSensitivity` est volontairement **omis**) :
`acceptance ← acceptance · trust ← trust · entourage ← externalInfluence · careAlignment ← decisionStage · careEngagement ← motivation`.

- [ ] **Step 1 : Écrire le fichier**

`lib/care-insights/dimensions.ts` :

```ts
import type { PsyRadar } from "@/lib/psychology/axes";

export const CARE_DIMENSIONS = [
  "acceptance", "trust", "entourage", "careAlignment", "careEngagement",
] as const;
export type CareDimension = (typeof CARE_DIMENSIONS)[number];

/** Score 0-10 par dimension soin, dérivé du radar psychologie existant. null si non observé. */
export function mapRadarToCare(radar: PsyRadar): Record<CareDimension, number | null> {
  return {
    acceptance: radar.acceptance,
    trust: radar.trust,
    entourage: radar.externalInfluence,
    careAlignment: radar.decisionStage,
    careEngagement: radar.motivation,
  };
}

export const CARE_LABEL_FR: Record<CareDimension, string> = {
  acceptance: "Acceptation", trust: "Confiance", entourage: "Entourage",
  careAlignment: "Adéquation du soin", careEngagement: "Engagement dans le soin",
};
export const CARE_LABEL_EN: Record<CareDimension, string> = {
  acceptance: "Acceptance", trust: "Trust", entourage: "Entourage",
  careAlignment: "Care Alignment", careEngagement: "Care engagement",
};
export const CARE_SUB_FR: Record<CareDimension, string> = {
  acceptance: "Cheminement vers l'acceptation de la perte auditive",
  trust: "Confiance construite avec le clinicien au fil des visites",
  entourage: "Rôle des proches dans la décision",
  careAlignment: "Adéquation entre le plan de soin proposé et le patient",
  careEngagement: "Implication du patient dans son parcours de soin",
};
export const CARE_SUB_EN: Record<CareDimension, string> = {
  acceptance: "Coming to terms with hearing loss",
  trust: "Confidence built with the clinician over visits",
  entourage: "How family or close ones shape the decision",
  careAlignment: "How aligned the care plan is with the patient",
  careEngagement: "Involvement in their own care journey",
};
export const CARE_CAPTURES_FR: Record<CareDimension, string> = {
  acceptance: "Déni, ambivalence ou acceptation — lu dans la façon dont le patient parle de ses difficultés.",
  trust: "Le patient se sent-il en sécurité, écouté, libre d'exprimer ses doutes.",
  entourage: "Qui compte, qui accompagne, qui pèse dans la décision — repris des mentions de l'entourage.",
  careAlignment: "Le soin proposé correspond-il à ce dont le patient a besoin et se sent prêt à entreprendre.",
  careEngagement: "Présence, suivi des recommandations, essais réalisés, questions sur sa santé auditive.",
};
export const CARE_CAPTURES_EN: Record<CareDimension, string> = {
  acceptance: "Denial, ambivalence or acceptance — read from how the patient talks about their difficulties.",
  trust: "Whether the patient feels safe, heard, and able to voice doubts.",
  entourage: "Who else matters, who accompanies, who weighs in — read from mentions of the entourage.",
  careAlignment: "Whether the proposed care fits what the patient needs and feels ready for.",
  careEngagement: "Attendance, follow-through, trials done, questions about their hearing health.",
};
export const CARE_USED_FR: Record<CareDimension, string> = {
  acceptance: "Rencontrer le patient là où il en est dans son cheminement.",
  trust: "Savoir si la relation est assez solide pour aborder des sujets plus difficiles.",
  entourage: "Impliquer les bonnes personnes au bon moment — l'audition est une affaire de famille.",
  careAlignment: "Aider le patient à se sentir confiant et soutenu dans le soin qui lui convient.",
  careEngagement: "Repérer un patient qui s'éloigne pour le ré-engager. Jamais l'intention d'achat.",
};
export const CARE_USED_EN: Record<CareDimension, string> = {
  acceptance: "Meet the patient where they are in their journey.",
  trust: "Tells whether the relationship is solid enough to broach harder topics.",
  entourage: "Bring the right people in at the right moment — hearing is a family matter.",
  careAlignment: "Help the patient feel confident and supported in the care that suits them.",
  careEngagement: "Spot a patient drifting away, to re-engage them. Never purchase intent.",
};
```

- [ ] **Step 2 : Typecheck + commit**

Run: `pnpm typecheck` → PASS
```bash
git add lib/care-insights/dimensions.ts
git commit -m "feat(care-insights): mapping dimensions soin display-only"
```

---

## Task 4 — Prompt + génération de la synthèse relationnelle

**Files:**
- Create: `lib/relationship/prompt.ts`
- Create: `lib/relationship/generate.ts`
- Create: `lib/relationship/queries.ts`

Référence patterns existants : `lib/psychology/prompt.ts` (structure prompt), `lib/psychology/score-session.ts` (appel Claude, `stripMarkdownFence`, parse JSON, upsert). **Réutiliser ces patterns** (ne pas réinventer le parsing).

- [ ] **Step 1 : Prompt**

`lib/relationship/prompt.ts` :

```ts
import { CLAUDE_MODELS } from "@/lib/claude";
import { COMMUNICATION_KEYS, SETBACK_KEYS, PRIORITY_KEYS } from "./taxonomy";

export const REL_PROMPT_VERSION = "rel-v1";
export const REL_MODEL = CLAUDE_MODELS.sonnet;

type BuildRelPromptInput = { patientLabel: string; transcript: string };

export function buildRelationshipPrompt(input: BuildRelPromptInput): string {
  return `Tu es un audioprothésiste senior qui rédige une synthèse relationnelle privée sur un patient, à l'usage du clinicien qui le suit. Tu analyses la relation de soin et le parcours commercial à partir du verbatim de toutes ses sessions.

PATIENT : ${input.patientLabel}

OBJECTIF
1. Rédiger une SYNTHÈSE CONTEXTUELLE en prose (3-5 paragraphes, français) : profil d'entrée, ressorts et freins, déroulé session par session, état de la relation, risque de décrochage, prochaine action recommandée. Tu peux y inclure l'impact commercial (panier, montée/descente en gamme) — c'est la lecture privée du clinicien.
2. Identifier des TAGS structurés à partir de listes FERMÉES (n'invente aucune clé hors liste) :
   - communication_style : comment le patient préfère être informé. lead = le style dominant (ou null). relevant = autres styles pertinents. Clés autorisées : ${COMMUNICATION_KEYS.join(", ")}.
   - setbacks : ce qui freine le soin. present = sous-ensemble pertinent. Clés autorisées : ${SETBACK_KEYS.join(", ")}.
   - priorities : ce qui compte le plus pour le patient. lead = priorité n°1 (ou null). relevant = autres priorités citées. Clés autorisées : ${PRIORITY_KEYS.join(", ")}.

RÈGLES
- Ne déduis rien au-delà du verbatim. Si un bloc n'est pas observable, renvoie des listes vides et lead null.
- Ton factuel et professionnel. Tu décris la relation de soin, jamais un jugement sur la personne.

FORMAT DE SORTIE — JSON valide UNIQUEMENT, sans préambule ni fence :
{
  "abstract_md": "...markdown...",
  "communication_style": {"lead": <clé|null>, "relevant": [<clé>, ...]},
  "setbacks": {"present": [<clé>, ...]},
  "priorities": {"lead": <clé|null>, "relevant": [<clé>, ...]}
}

VERBATIM DE TOUTES LES SESSIONS
---
${input.transcript}
---`;
}
```

- [ ] **Step 2 : Génération + upsert**

`lib/relationship/generate.ts` — agrège les transcripts de toutes les sessions du patient (ordre chronologique, en-tête par session), appelle Claude, parse, upsert :

```ts
import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, transcriptLines, patients, patientRelationshipSynthesis } from "@/db/schema";
import { getAnthropic } from "@/lib/claude";
import { COMMUNICATION_KEYS, SETBACK_KEYS, PRIORITY_KEYS } from "./taxonomy";
import { buildRelationshipPrompt, REL_MODEL, REL_PROMPT_VERSION } from "./prompt";
import type { CommunicationStyleKey, SetbackKey, PriorityKey } from "./types";

export type GenerateRelOutcome =
  | { ok: true; patientId: string; sessionsCount: number }
  | { skipped: "no-patient" | "no-transcript" };

function stripFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) return t.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/\n?```\s*$/, "").trim();
  return t;
}
function keepKnown<T extends string>(arr: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x));
}
function keepOne<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export async function generateRelationshipSynthesis(patientId: string): Promise<GenerateRelOutcome> {
  const [patient] = await db.select({ id: patients.id, label: patients.label })
    .from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!patient) return { skipped: "no-patient" };

  const sess = await db.select({ id: sessions.id, startedAt: sessions.startedAt, kind: sessions.kind })
    .from(sessions).where(eq(sessions.patientId, patientId)).orderBy(asc(sessions.startedAt));
  if (sess.length === 0) return { skipped: "no-transcript" };

  const lines = await db.select().from(transcriptLines)
    .where(inArray(transcriptLines.sessionId, sess.map((s) => s.id)))
    .orderBy(asc(transcriptLines.startMs));
  if (lines.length === 0) return { skipped: "no-transcript" };

  const bySession = new Map<string, typeof lines>();
  for (const l of lines) {
    const arr = bySession.get(l.sessionId) ?? [];
    arr.push(l); bySession.set(l.sessionId, arr);
  }
  const transcript = sess.map((s, i) => {
    const body = (bySession.get(s.id) ?? [])
      .map((l) => `[${l.speaker === "practitioner" ? "PRO" : "PATIENT"}] ${l.text}`).join("\n");
    const date = s.startedAt ? new Date(s.startedAt).toISOString().slice(0, 10) : "?";
    return `## Session ${i + 1} (${s.kind}, ${date})\n${body}`;
  }).join("\n\n");

  const prompt = buildRelationshipPrompt({ patientLabel: patient.label, transcript });
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: REL_MODEL, max_tokens: 4096, messages: [{ role: "user", content: prompt }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Claude n'a pas retourné de texte");
  const parsed = JSON.parse(stripFence(block.text)) as Record<string, unknown>;

  const comm = (parsed.communication_style ?? {}) as Record<string, unknown>;
  const setb = (parsed.setbacks ?? {}) as Record<string, unknown>;
  const prio = (parsed.priorities ?? {}) as Record<string, unknown>;
  const values = {
    patientId,
    abstractMd: typeof parsed.abstract_md === "string" ? parsed.abstract_md : "",
    communicationStyle: {
      lead: keepOne<CommunicationStyleKey>(comm.lead, COMMUNICATION_KEYS),
      relevant: keepKnown<CommunicationStyleKey>(comm.relevant, COMMUNICATION_KEYS),
    },
    setbacks: { present: keepKnown<SetbackKey>(setb.present, SETBACK_KEYS) },
    priorities: {
      lead: keepOne<PriorityKey>(prio.lead, PRIORITY_KEYS),
      relevant: keepKnown<PriorityKey>(prio.relevant, PRIORITY_KEYS),
    },
    sessionsCount: sess.length,
    model: REL_MODEL,
    promptVersion: REL_PROMPT_VERSION,
    rawOutput: parsed as unknown,
  };

  await db.insert(patientRelationshipSynthesis).values(values)
    .onConflictDoUpdate({
      target: patientRelationshipSynthesis.patientId,
      set: { ...values, updatedAt: new Date() },
    });
  return { ok: true, patientId, sessionsCount: sess.length };
}
```

- [ ] **Step 3 : Query de lecture**

`lib/relationship/queries.ts` :

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patientRelationshipSynthesis } from "@/db/schema";
import type { RelationshipSynthesis } from "./types";

export async function getRelationshipSynthesis(patientId: string): Promise<RelationshipSynthesis | null> {
  const [row] = await db.select().from(patientRelationshipSynthesis)
    .where(eq(patientRelationshipSynthesis.patientId, patientId)).limit(1);
  if (!row) return null;
  return {
    abstractMd: row.abstractMd,
    communicationStyle: row.communicationStyle as RelationshipSynthesis["communicationStyle"],
    setbacks: row.setbacks as RelationshipSynthesis["setbacks"],
    priorities: row.priorities as RelationshipSynthesis["priorities"],
    sessionsCount: row.sessionsCount,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 4 : Typecheck + commit**

Run: `pnpm typecheck` → PASS
```bash
git add lib/relationship/prompt.ts lib/relationship/generate.ts lib/relationship/queries.ts
git commit -m "feat(relationship): prompt + génération + lecture synthèse patient"
```

---

## Task 5 — Script CLI de pré-génération

**Files:**
- Create: `scripts/relationship-generate.ts`
- Modify: `package.json` (scripts)

Pattern de référence : `scripts/psy-score-session.ts` / `scripts/psy-rescore-all.ts` (chargement env, parse argv, appel lib, log). **Lire `scripts/psy-rescore-all.ts` pour copier le boilerplate d'init** (dotenv, `--conditions react-server`).

- [ ] **Step 1 : Script**

`scripts/relationship-generate.ts` — accepte un ou plusieurs `patientId` en argv, ou `--all` (tous les patients ayant au moins une session avec transcript) :

```ts
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { generateRelationshipSynthesis } from "@/lib/relationship/generate";

async function main() {
  const args = process.argv.slice(2);
  let ids: string[] = args.filter((a) => !a.startsWith("--"));
  if (args.includes("--all") || ids.length === 0) {
    const rows = await db.execute<{ patient_id: string }>(sql`
      SELECT DISTINCT s.patient_id FROM sessions s
      JOIN transcript_lines tl ON tl.session_id = s.id
      WHERE s.patient_id IS NOT NULL`);
    ids = rows.map((r) => r.patient_id);
  }
  console.log(`Génération synthèse pour ${ids.length} patient(s)…`);
  for (const id of ids) {
    const out = await generateRelationshipSynthesis(id);
    console.log(id, "→", JSON.stringify(out));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

(Adapter l'accès `rows` au type de retour réel de `db.execute` observé dans les autres scripts.)

- [ ] **Step 2 : Ajouter le script npm**

Dans `package.json`, après `"psy:backdate-snapshots": ...`, ajouter :
```json
    "relationship:generate": "tsx --conditions react-server scripts/relationship-generate.ts",
```

- [ ] **Step 3 : Commit (sans exécuter encore — l'exécution se fait en Task 9)**

```bash
git add scripts/relationship-generate.ts package.json
git commit -m "feat(relationship): script CLI de pré-génération"
```

---

## Task 6 — Composant `PatientInsightsView` (jauges + tags)

**Files:**
- Create: `components/patients/patient-insights-view.tsx` (Client Component)

Mirroir de `patient_insight_14.html`, en charte rouge (réutiliser les classes Tailwind/tokens déjà présents : `--brand`/`text-brand`, `bg-surface`, `border-border`, `text-muted-foreground`, `bg-light`). Pattern d'interactivité (panneau détail au clic) calqué sur le mockup ; pattern de composant client calqué sur `psychology-radar-card.tsx` (hooks `useState`, `useTranslations`, `useLocale`).

**Props :**
```ts
type PatientInsightsViewProps = {
  dimensions: Array<{ key: CareDimension; score: number | null }>;
  communicationStyle: { lead: CommunicationStyleKey | null; relevant: CommunicationStyleKey[] };
  setbacks: { present: SetbackKey[] };
  priorities: { lead: PriorityKey | null; relevant: PriorityKey[] };
};
```

- [ ] **Step 1 : Implémenter le composant**

Structure (suivre le mockup) :
- Colonne gauche : liste des 5 dimensions sous forme de **barres** (`bg-track` + remplissage `bg-brand`, largeur = `score*10%`). Chaque ligne cliquable met à jour un panneau détail à droite. Si `score === null` → barre vide + libellé « non observé » (`t("notObserved")`).
- Panneau détail (droite) : titre dimension (`CARE_LABEL_*`), sous-titre (`CARE_SUB_*`), barre, bloc « Capte » (`CARE_CAPTURES_*`) + bloc « Sert à » (`CARE_USED_*`). Sélection par défaut = première dimension ayant un score non-null, sinon la première.
- Sous les barres : 3 blocs de tags (Communication / Setbacks / Priorities). Pour chaque taxonomie, afficher **toutes** les clés ; styler `lead` (plein `bg-brand text-white`), `relevant`/`present` (contour `border-brand/40 text-brand bg-brand/10`), le reste grisé (`bg-light text-muted-foreground`). Libellés via `communicationLabel` / `setbackLabel` / `priorityLabel` selon `useLocale()`.
- Aucune mention « profil psychologique », aucun score commercial, aucun « € ».

Imports : `from "@/lib/care-insights/dimensions"` (CARE_DIMENSIONS, CARE_LABEL_*, CARE_SUB_*, CARE_CAPTURES_*, CARE_USED_*), `from "@/lib/relationship/taxonomy"` (clés + label fns), types depuis `@/lib/relationship/types`.

- [ ] **Step 2 : Typecheck + lint**

Run: `pnpm typecheck && pnpm lint` → PASS

- [ ] **Step 3 : Commit**

```bash
git add components/patients/patient-insights-view.tsx
git commit -m "feat(patients): vue Patient Insights (jauges soin + tags)"
```

---

## Task 7 — Composants `RelationshipAbstractView` + `PatientTabs`

**Files:**
- Create: `components/patients/relationship-abstract-view.tsx`
- Create: `components/patients/patient-tabs.tsx` (Client Component)

- [ ] **Step 1 : RelationshipAbstractView**

Reçoit `{ abstractMd: string; updatedAt: Date | null }`. Rend le markdown via `react-markdown` + `remark-gfm` (déjà deps ; voir usage dans `components/admin/vault-markdown.tsx`) dans un conteneur `prose`-like (réutiliser les classes du rendu markdown existant). Sous le texte : `t("updatedAt", { date })` si `updatedAt`. Si `abstractMd` vide → message `t("abstractEmpty")`. Peut être un Server Component (pas d'interactivité) — pas de `"use client"`.

- [ ] **Step 2 : PatientTabs (coquille Radix)**

`components/patients/patient-tabs.tsx` :

```tsx
"use client";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function PatientTabs({
  journey, insights, abstract, detail,
}: {
  journey: React.ReactNode; insights: React.ReactNode;
  abstract: React.ReactNode; detail: React.ReactNode;
}) {
  const t = useTranslations("patientTabs");
  return (
    <Tabs defaultValue="journey" className="w-full">
      <TabsList>
        <TabsTrigger value="journey">{t("journey")}</TabsTrigger>
        <TabsTrigger value="insights">{t("insights")}</TabsTrigger>
        <TabsTrigger value="abstract">{t("abstract")}</TabsTrigger>
        <TabsTrigger value="detail">{t("detail")}</TabsTrigger>
      </TabsList>
      <TabsContent value="journey">{journey}</TabsContent>
      <TabsContent value="insights">{insights}</TabsContent>
      <TabsContent value="abstract">{abstract}</TabsContent>
      <TabsContent value="detail">{detail}</TabsContent>
    </Tabs>
  );
}
```

(Les Server Components rendus côté page sont passés en `ReactNode` props — pattern supporté par Next.js App Router.)

- [ ] **Step 3 : Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint` → PASS
```bash
git add components/patients/relationship-abstract-view.tsx components/patients/patient-tabs.tsx
git commit -m "feat(patients): vues Relationship Abstract + coquille onglets"
```

---

## Task 8 — Câblage page patient + i18n + reformulation copy

**Files:**
- Modify: `app/patients/[id]/page.tsx`
- Modify: `messages/fr.json`, `messages/en.json`

- [ ] **Step 1 : Ajouter les namespaces i18n**

Dans `messages/fr.json`, ajouter au top-level :
```json
  "patientTabs": {
    "journey": "Parcours",
    "insights": "Patient Insights",
    "abstract": "Synthèse relationnelle",
    "detail": "Détail relationnel"
  },
  "careInsights": {
    "heading": "Compréhension du patient",
    "subheading": "Dimensions du soin",
    "notObserved": "non observé",
    "captures": "Capte",
    "usedTo": "Sert à",
    "commHeading": "Style de communication",
    "commSub": "Comment le patient préfère être informé et accompagné.",
    "setbacksHeading": "Freins — ce qui retient le soin",
    "setbacksSub": "Les raisons principales pour lesquelles ce patient n'est pas encore aidé — pour y répondre, pas pour pousser.",
    "prioritiesHeading": "Priorités — ce qui compte le plus",
    "prioritiesSub": "Exprimé par le patient. Jamais noté.",
    "legendTop": "Principal", "legendRelevant": "Aussi pertinent", "legendOff": "Non pertinent"
  },
  "relationship": {
    "abstractEmpty": "Synthèse non encore générée pour ce patient.",
    "updatedAt": "Mis à jour le {date}"
  },
```

Dans `messages/en.json`, les équivalents :
```json
  "patientTabs": {
    "journey": "Journey", "insights": "Patient Insights",
    "abstract": "Relationship Abstract", "detail": "Relationship Detail"
  },
  "careInsights": {
    "heading": "Understanding", "subheading": "Care dimensions",
    "notObserved": "not observed", "captures": "Captures", "usedTo": "Used to",
    "commHeading": "Communication style",
    "commSub": "How the patient prefers to be informed and accompanied.",
    "setbacksHeading": "Setbacks — what holds care back",
    "setbacksSub": "The main reasons this patient may not yet be helped — to address them, not to push.",
    "prioritiesHeading": "Priorities — what matters most",
    "prioritiesSub": "Stated by the patient. Never scored.",
    "legendTop": "Top", "legendRelevant": "Also relevant", "legendOff": "Not relevant"
  },
  "relationship": {
    "abstractEmpty": "Synthesis not generated yet for this patient.",
    "updatedAt": "Updated on {date}"
  },
```

- [ ] **Step 2 : Reformuler les libellés « profil psychologique » visibles sur la page patient**

Dans `messages/fr.json` namespace `psychology` (et `en.json`), remplacer le **terme visible** sans casser les clés. Le radar est retiré de la page, mais le `MarketingConsentToggle` reste sur le header patient :
- `consentEnabledTooltip` : remplacer « profil psychologique » → « la synthèse relationnelle ».
- `consentRevokedTooltip`, `consentMissingTooltip` : idem (« Synthèse exclue des exports »).
- `cardTitle` : « Profil psychologique » → « Patient Insights » (au cas où réutilisé ailleurs).
- `ariaLabel` : « Profil psychologique patient » → « Patient Insights ».
Ne PAS toucher aux clés `exportProfile*` (feature export hors scope, inchangée).

- [ ] **Step 3 : Réécrire `app/patients/[id]/page.tsx`**

Conserver le `PageHeader` et tout le fetch existant (`getPatientDetail`, vault, `getPatientSnapshots`, `computeGlobalRadar`). **Ajouter** : `getRelationshipSynthesis(patient.id)` et le mapping `mapRadarToCare(globalRadar)`. Remplacer le bloc `<div className="grid ... lg:grid-cols-12">…</div>` (lignes ~154-218) par un `<PatientTabs>` recevant 4 sections :

```tsx
const synthesis = await getRelationshipSynthesis(patient.id);
const care = mapRadarToCare(globalRadar);
const careDims = CARE_DIMENSIONS.map((key) => ({ key, score: care[key] }));

// ... dans le JSX, à la place de la grille :
<PatientTabs
  journey={<PatientTimeline events={events} />}
  insights={
    hasAnyScore || synthesis ? (
      <PatientInsightsView
        dimensions={careDims}
        communicationStyle={synthesis?.communicationStyle ?? { lead: null, relevant: [] }}
        setbacks={synthesis?.setbacks ?? { present: [] }}
        priorities={synthesis?.priorities ?? { lead: null, relevant: [] }}
      />
    ) : (
      <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
    )
  }
  abstract={
    <RelationshipAbstractView
      abstractMd={synthesis?.abstractMd ?? ""}
      updatedAt={synthesis?.updatedAt ?? null}
    />
  }
  detail={
    vaultPage ? (
      <VaultMarkdown raw={vaultPage.contentMd} pageIndex={pageIndex} />
    ) : (
      <p className="text-sm text-muted-foreground">{t("noVaultYet")}</p>
    )
  }
/>
```

Ajouter les imports : `PatientTabs`, `PatientInsightsView`, `RelationshipAbstractView`, `VaultMarkdown` (`@/components/admin/vault-markdown`), `getRelationshipSynthesis`, `mapRadarToCare` + `CARE_DIMENSIONS`. Retirer l'import et l'usage de `PsychologyRadarCard` et `MemoryView` **dans cette page** (ne pas supprimer les fichiers : `PsychologyRadarCard` peut être référencé ailleurs — vérifier par grep ; `MemoryView` n'est plus utilisé ici mais reste pour la suite). Conserver le lien « Ouvrir la fiche complète » vers `/admin/vault/...` au-dessus de l'onglet Detail ou dans le header.

- [ ] **Step 4 : Vérifier**

Run: `pnpm typecheck && pnpm lint` → PASS

- [ ] **Step 5 : Commit**

```bash
git add app/patients/[id]/page.tsx messages/fr.json messages/en.json
git commit -m "feat(patients): page patient en 4 onglets + dé-commercialisation copy"
```

---

## Task 9 — Génération démo + vérification de bout en bout

**Files:** aucune modification (exécution + vérif)

- [ ] **Step 1 : Générer la synthèse pour les patients de démo**

Run: `pnpm relationship:generate --all`
Expected : log `→ {"ok":true,...}` pour chaque patient ayant des transcripts (dont Gian Carlo Gozzelino, Mme Durand, M. Martin). Coût ~quelques centimes par patient (Sonnet). Si un patient n'a pas de transcript → `skipped`, normal.

- [ ] **Step 2 : Lancer le dev server et tester les 4 onglets**

Run: `pnpm dev`
Ouvrir un patient (ex. la fiche de Gian Carlo Gozzelino ou Mme Durand). Vérifier :
- Onglet **Parcours** : timeline identique à avant.
- Onglet **Patient Insights** : 5 barres (Acceptation, Confiance, Entourage, Adéquation du soin, Engagement dans le soin), clic → panneau détail ; 3 blocs de tags avec états visuels. **Aucune** mention « profil psychologique », « sensibilité prix », « € ».
- Onglet **Synthèse relationnelle** : prose générée + date « Mis à jour le… ».
- Onglet **Détail relationnel** : fiche vault complète rendue.
- Toggle **FR/EN** : libellés d'onglets et de dimensions traduits.

- [ ] **Step 3 : Non-régression (CRITIQUE — ne rien casser avant la démo)**

Vérifier que les features qui consomment encore le backend psychologie marchent toujours :
- **Dashboard** : la recall list / nudges s'affichent (composant `recall-list.tsx`, `searchPatientsByTags`).
- **Liste patients** (`/patients`) : tags et scores moyens affichés normalement.
- **Export** : le bouton Export du header patient répond (téléchargement CSV/XLSX) — feature inchangée.
- `pnpm build` → PASS (compile prod, détecte les erreurs SSR/RSC éventuelles).

- [ ] **Step 4 : Commit final (si ajustements)**

```bash
git add -A
git commit -m "chore(patients): ajustements post-vérif onglets patient"
```

---

## Self-Review — couverture du spec

- 4 onglets cliquables sur la même page → Task 7 (PatientTabs) + Task 8 (câblage). ✅
- Patient Journey = timeline existante → Task 8. ✅
- Patient Insights dé-commercialisés (barres + tags, plus de « profil psychologique ») → Task 3 (mapping) + Task 6 (vue) + Task 8 (copy). ✅
- Relationship Abstract généré par IA → Tasks 1, 2, 4, 5, 9. ✅
- Relationship Detail = fiche vault → Task 8. ✅
- Ne rien casser (exports/recall/liste/artefacts intacts) → contrainte respectée (additif + Task 9 non-régression). ✅
- Charte rouge conservée → Tasks 6/7 (tokens existants). ✅
- Bilingue FR/EN → Task 8 (namespaces). ✅

**Hors scope (post-démo, Option B) :** rewrite des axes/tags dans tout le backend, migration `session_psychology_snapshots`, re-score, refonte exports/recall, vues Clinician Insight + Manager Dashboard.
