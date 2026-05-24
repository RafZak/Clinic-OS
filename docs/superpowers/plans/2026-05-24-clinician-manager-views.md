# Clinician Insight + Manager Dashboard — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter deux écrans care-quality — Clinician Insight (radar 6 axes du clinicien, généré par IA, section du dashboard) et Manager Dashboard (agrégat anonyme d'équipe de 4, seedé, sous Admin) — sans toucher au pipeline existant.

**Architecture :** Nouvelle table additive `practitioner_care_snapshots` (1 ligne/praticien, 6 scores 0-100 + rationale FR/EN). Clinician Insight = 1 appel IA tool_use sur les consultations du praticien courant (Jonathan via `getCurrentQuizPractitioner`). Manager Dashboard = agrégation (moyenne + distribution par palier) sur les 4 snapshots du centre (Jonathan IA + 3 fictifs seedés). Radar SVG dédié générique (on ne touche pas au radar patient).

**Tech Stack :** Next.js 16 App Router, TS strict, Drizzle/Postgres (Supabase), Anthropic SDK tool_use, next-intl FR/EN. Pas de framework de tests → vérif via `pnpm typecheck` + `pnpm build` + dev (cookie `clinic_os_user=Jonathan`) + Supabase MCP. Migration via Supabase MCP `apply_migration` (projet `geyyfrqloisqgfmapqjk`), jamais `db:push`.

**Réf :** spec `docs/superpowers/specs/2026-05-24-clinician-manager-views-design.md` ; maquettes `clinician_insight.html` / `manager_dashboard.html`.

---

## File Structure

**Créés :**
- `lib/care-quality/axes.ts` — 6 axes + libellés/sous-titres/captures/usedTo FR-EN + chaîne de valeur (statique).
- `lib/care-quality/types.ts` — `CareRadar`, `CareSnapshot`, tiers.
- `lib/care-quality/prompt.ts` — prompt de génération clinicien.
- `lib/care-quality/generate.ts` — `generatePractitionerCareSnapshot` (tool_use).
- `lib/care-quality/queries.ts` — lectures (snapshot praticien, snapshots équipe).
- `lib/care-quality/aggregate.ts` — moyenne équipe + distribution par palier.
- `components/care/care-radar.tsx` — radar SVG générique 6 axes (client).
- `components/care/clinician-insight.tsx` — section dashboard (client).
- `components/care/manager-dashboard-view.tsx` — vue admin (client).
- `app/admin/manager/page.tsx` — page serveur Manager Dashboard.
- `scripts/clinician-generate.ts` — CLI génération IA (praticien).
- `scripts/seed-care-team.ts` — seed 3 praticiens fictifs + snapshots.

**Modifiés :**
- `db/schema.ts` — table `practitionerCareSnapshots`.
- `lib/nav-config.ts` — NavKey `"manager"` + entrée ADMIN_NAV.
- `app/page.tsx` — insertion section Clinician Insight (audioprothésiste only).
- `messages/fr.json`, `messages/en.json` — namespaces `clinicianInsight`, `managerDashboard`, clé `nav.manager`.
- `package.json` — scripts `clinician:generate`, `seed:care-team`.

---

## Task 1 — Table `practitioner_care_snapshots`

**Files:** Modify `db/schema.ts` (après `patientRelationshipSynthesis`).

- [ ] **Step 1 : Ajouter la table**

```ts
// ==================================================================
// 15sexies. Snapshot care-quality praticien (1 par praticien, additif)
// Clinician Insight (IA) + Manager Dashboard (agrégat). N'affecte rien.
// ==================================================================
export const practitionerCareSnapshots = pgTable(
  "practitioner_care_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    rapportScore: smallint("rapport_score"),
    pedagogyScore: smallint("pedagogy_score"),
    structureScore: smallint("structure_score"),
    guidanceScore: smallint("guidance_score"),
    followThroughScore: smallint("follow_through_score"),
    adaptabilityScore: smallint("adaptability_score"),
    // { rapport: {fr, en}, ... } — 1 phrase / axe / langue (null si seed)
    rationale: jsonb("rationale"),
    source: text("source").notNull(), // 'ai' | 'seed'
    sessionsCount: smallint("sessions_count").notNull().default(0),
    model: text("model"),
    promptVersion: text("prompt_version"),
    rawOutput: jsonb("raw_output"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("practitioner_care_snapshots_practitioner_unique").on(
      t.practitionerId
    ),
  ]
);
```

- [ ] **Step 2 : Appliquer la migration via Supabase MCP** (PAS `db:push`)

Utiliser l'outil `mcp__claude_ai_Supabase__apply_migration`, project_id `geyyfrqloisqgfmapqjk`, name `add_practitioner_care_snapshots`, query :
```sql
CREATE TABLE IF NOT EXISTS "practitioner_care_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "practitioner_id" uuid NOT NULL,
  "rapport_score" smallint, "pedagogy_score" smallint, "structure_score" smallint,
  "guidance_score" smallint, "follow_through_score" smallint, "adaptability_score" smallint,
  "rationale" jsonb, "source" text NOT NULL, "sessions_count" smallint DEFAULT 0 NOT NULL,
  "model" text, "prompt_version" text, "raw_output" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "practitioner_care_snapshots_practitioner_unique" UNIQUE("practitioner_id"),
  CONSTRAINT "practitioner_care_snapshots_practitioner_id_fk"
    FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE cascade
);
```
Sauver aussi cette SQL dans `drizzle/manual/2026-05-24-practitioner-care-snapshots.sql`.

- [ ] **Step 3 : Vérifier** `pnpm typecheck` → PASS. **Commit** `feat(db): table practitioner_care_snapshots (additive)`.

---

## Task 2 — Axes care-quality (statique FR/EN)

**Files:** Create `lib/care-quality/axes.ts`, `lib/care-quality/types.ts`.

- [ ] **Step 1 : types.ts**

```ts
export const CARE_AXES = [
  "rapport", "pedagogy", "structure", "guidance", "followThrough", "adaptability",
] as const;
export type CareAxis = (typeof CARE_AXES)[number];
export type CareRadar = Record<CareAxis, number | null>; // 0-100
export type AxisRationale = { fr: string; en: string };
export type CareSnapshot = {
  practitionerId: string;
  radar: CareRadar;
  rationale: Partial<Record<CareAxis, AxisRationale>> | null;
  source: "ai" | "seed";
  sessionsCount: number;
  updatedAt: Date;
};
export type CareTier = "signature" | "solid" | "developing";
export function tierFor(score: number): CareTier {
  if (score >= 75) return "signature";
  if (score >= 50) return "solid";
  return "developing";
}
```

- [ ] **Step 2 : axes.ts** — libellés + copie statique (transcrits de `clinician_insight.html`, + FR).

```ts
import type { CareAxis } from "./types";
export const CARE_LABEL_FR: Record<CareAxis, string> = {
  rapport: "Relation", pedagogy: "Pédagogie", structure: "Structure de consultation",
  guidance: "Clarté de l'accompagnement", followThrough: "Suivi", adaptability: "Adaptabilité",
};
export const CARE_LABEL_EN: Record<CareAxis, string> = {
  rapport: "Rapport", pedagogy: "Pedagogy", structure: "Consultation structure",
  guidance: "Guidance clarity", followThrough: "Follow-through", adaptability: "Adaptability",
};
export const CARE_SUB_FR: Record<CareAxis, string> = {
  rapport: "Confiance et chaleur — le patient se sent entendu.",
  pedagogy: "Explication claire — complexité rendue compréhensible.",
  structure: "Une visite complète et rigoureuse.",
  guidance: "Aide le patient à bien décider.",
  followThrough: "Continuité après la visite.",
  adaptability: "S'adapte à des styles de patients très différents.",
};
export const CARE_SUB_EN: Record<CareAxis, string> = {
  rapport: "Trust and warmth — patients feel heard",
  pedagogy: "Clear explanation — complexity made understandable",
  structure: "A complete, thorough visit",
  guidance: "Helps the patient decide well",
  followThrough: "Continuity after the visit",
  adaptability: "Flexes to very different patient styles",
};
export const CARE_CAPTURES_FR: Record<CareAxis, string> = {
  rapport: "Marqueurs relationnels : reformulation empathique, écoute active, reconnaissance des émotions.",
  pedagogy: "Comment le clinicien explique les options et vérifie que le patient a compris.",
  structure: "Présence des étapes clés : anamnèse, reformulation du besoin, explication des options, prochaines étapes.",
  guidance: "Avec quelle clarté le clinicien expose les choix et accompagne la décision.",
  followThrough: "Relances pertinentes, engagement post-visite — le patient ne se sent pas abandonné.",
  adaptability: "L'éventail de styles relationnels que le clinicien sait mobiliser.",
};
export const CARE_CAPTURES_EN: Record<CareAxis, string> = {
  rapport: "Relational markers: empathetic reformulation, active listening, acknowledgement of feelings.",
  pedagogy: "How the clinician explains options and checks the patient actually understood.",
  structure: "Presence of the key steps: case history, reformulating the need, explaining options, next steps.",
  guidance: "How clearly the clinician lays out the choices and accompanies the decision.",
  followThrough: "Relevant follow-ups, post-visit engagement — the patient doesn't feel abandoned.",
  adaptability: "The range of relational styles the clinician can mobilise.",
};
export const CARE_NOT_FR: Record<CareAxis, string> = {
  rapport: "Une force de développement — jamais une note de personnalité.",
  pedagogy: "Mesure la clarté du soin — pas la force de persuasion.",
  structure: "Complétude de l'acte de soin — jamais le rendement commercial par RDV.",
  guidance: "Aider le patient à décider — jamais conclure une vente.",
  followThrough: "Continuité du soin — pas une métrique de relance pour upsell.",
  adaptability: "Étendue des styles de soin — jamais la capacité à lever des objections.",
};
export const CARE_NOT_EN: Record<CareAxis, string> = {
  rapport: "A developmental strength — never a personality grade.",
  pedagogy: "Measures clarity of care — not persuasiveness.",
  structure: "Completeness of the care act — never commercial output per appointment.",
  guidance: "Helping the patient decide — never closing a sale.",
  followThrough: "Continuity of care — not a recall-to-upsell metric.",
  adaptability: "Breadth of care styles — never ability to overcome objections.",
};
```

- [ ] **Step 3 :** `pnpm typecheck` → PASS. **Commit** `feat(care-quality): axes + copie statique FR/EN`.

---

## Task 3 — Lecture + agrégation

**Files:** Create `lib/care-quality/queries.ts`, `lib/care-quality/aggregate.ts`.

- [ ] **Step 1 : queries.ts**

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { practitionerCareSnapshots, practitioners } from "@/db/schema";
import { CARE_AXES, type CareRadar, type CareSnapshot } from "./types";

type Row = typeof practitionerCareSnapshots.$inferSelect;
function rowToSnapshot(r: Row): CareSnapshot {
  const radar: CareRadar = {
    rapport: r.rapportScore, pedagogy: r.pedagogyScore, structure: r.structureScore,
    guidance: r.guidanceScore, followThrough: r.followThroughScore, adaptability: r.adaptabilityScore,
  };
  return {
    practitionerId: r.practitionerId, radar,
    rationale: (r.rationale as CareSnapshot["rationale"]) ?? null,
    source: r.source === "seed" ? "seed" : "ai",
    sessionsCount: r.sessionsCount, updatedAt: r.updatedAt,
  };
}

export async function getPractitionerCareSnapshot(practitionerId: string): Promise<CareSnapshot | null> {
  const [row] = await db.select().from(practitionerCareSnapshots)
    .where(eq(practitionerCareSnapshots.practitionerId, practitionerId)).limit(1);
  return row ? rowToSnapshot(row) : null;
}

/** Tous les snapshots des praticiens d'un centre (pour l'agrégat manager). */
export async function getCenterCareSnapshots(centerId: string): Promise<CareSnapshot[]> {
  const rows = await db.select({ snap: practitionerCareSnapshots })
    .from(practitionerCareSnapshots)
    .innerJoin(practitioners, eq(practitioners.id, practitionerCareSnapshots.practitionerId))
    .where(eq(practitioners.centerId, centerId));
  return rows.map((r) => rowToSnapshot(r.snap));
}
void CARE_AXES;
```

- [ ] **Step 2 : aggregate.ts**

```ts
import { CARE_AXES, type CareAxis, type CareRadar, type CareSnapshot, type CareTier, tierFor } from "./types";

/** Moyenne par axe sur les snapshots ayant une valeur (arrondie). null si aucun. */
export function computeTeamAverage(snaps: CareSnapshot[]): CareRadar {
  const radar = {} as CareRadar;
  for (const axis of CARE_AXES) {
    const vals = snaps.map((s) => s.radar[axis]).filter((v): v is number => v !== null);
    radar[axis] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  return radar;
}

/** Distribution par axe : nb de cliniciens par palier (jamais qui). */
export function computeDistribution(
  snaps: CareSnapshot[]
): Record<CareAxis, Record<CareTier, number>> {
  const out = {} as Record<CareAxis, Record<CareTier, number>>;
  for (const axis of CARE_AXES) {
    const d: Record<CareTier, number> = { signature: 0, solid: 0, developing: 0 };
    for (const s of snaps) {
      const v = s.radar[axis];
      if (v !== null) d[tierFor(v)] += 1;
    }
    out[axis] = d;
  }
  return out;
}
```

- [ ] **Step 3 :** `pnpm typecheck` → PASS. **Commit** `feat(care-quality): lecture + agrégation équipe`.

---

## Task 4 — Génération IA (clinicien)

**Files:** Create `lib/care-quality/prompt.ts`, `lib/care-quality/generate.ts`. Pattern = `lib/relationship/generate.ts` (tool_use, agrégation transcripts).

- [ ] **Step 1 : prompt.ts**

```ts
import { CLAUDE_MODELS } from "@/lib/claude";
export const CARE_PROMPT_VERSION = "care-v1";
export const CARE_MODEL = CLAUDE_MODELS.sonnet;

export function buildClinicianCarePrompt(input: { practitionerLabel: string; transcript: string }): string {
  return `Tu évalues la QUALITÉ DE SOIN d'un audioprothésiste (le PROFESSIONNEL, jamais le patient) à partir du verbatim de toutes ses consultations. Logique de soin, jamais de vente.

PROFESSIONNEL : ${input.practitionerLabel}

Évalue 6 axes sur 0-100, agrégés sur l'ensemble des consultations :
- rapport : confiance et chaleur, le patient se sent entendu (reformulation empathique, écoute active).
- pedagogy : clarté d'explication, vérifie la compréhension du patient (jamais la persuasion).
- structure : visite complète (anamnèse, reformulation du besoin, options, prochaines étapes).
- guidance : aide le patient à décider sereinement (jamais conclure une vente).
- followThrough : continuité après la visite, relances pertinentes (jamais relance pour upsell).
- adaptability : éventail de styles relationnels mobilisés selon les patients.

Pour chaque axe : un score 0-100 + une rationale d'1 phrase, en français ET en anglais. Si un axe n'est pas observable, score null et rationale null. Reste factuel, fondé sur le verbatim, sans jugement de personnalité.

Renseigne le résultat via l'outil record_care_profile.

VERBATIM DES CONSULTATIONS
---
${input.transcript}
---`;
}
```

- [ ] **Step 2 : generate.ts** — tool_use, agrège les consultations (`kind='consultation'`) du praticien, upsert.

```ts
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, transcriptLines, practitioners, practitionerCareSnapshots } from "@/db/schema";
import { getAnthropic } from "@/lib/claude";
import { CARE_AXES, type CareAxis } from "./types";
import { buildClinicianCarePrompt, CARE_MODEL, CARE_PROMPT_VERSION } from "./prompt";

export type GenerateCareOutcome =
  | { ok: true; practitionerId: string; sessionsCount: number }
  | { skipped: "no-practitioner" | "no-transcript" };

const axisProp = {
  type: "object",
  properties: {
    score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
    rationale_fr: { type: ["string", "null"] },
    rationale_en: { type: ["string", "null"] },
  },
  required: ["score", "rationale_fr", "rationale_en"],
} as const;

const CARE_TOOL: Anthropic.Tool = {
  name: "record_care_profile",
  description: "Enregistre le profil care-quality (6 axes 0-100 + rationale FR/EN).",
  input_schema: {
    type: "object",
    properties: Object.fromEntries(CARE_AXES.map((a) => [a, axisProp])) as Record<string, unknown>,
    required: [...CARE_AXES],
  },
};

const COL: Record<CareAxis, "rapportScore" | "pedagogyScore" | "structureScore" | "guidanceScore" | "followThroughScore" | "adaptabilityScore"> = {
  rapport: "rapportScore", pedagogy: "pedagogyScore", structure: "structureScore",
  guidance: "guidanceScore", followThrough: "followThroughScore", adaptability: "adaptabilityScore",
};

export async function generatePractitionerCareSnapshot(practitionerId: string): Promise<GenerateCareOutcome> {
  const [pro] = await db.select({ id: practitioners.id, fullName: practitioners.fullName })
    .from(practitioners).where(eq(practitioners.id, practitionerId)).limit(1);
  if (!pro) return { skipped: "no-practitioner" };

  const sess = await db.select({ id: sessions.id, startedAt: sessions.startedAt })
    .from(sessions)
    .where(and(eq(sessions.practitionerId, practitionerId), eq(sessions.kind, "consultation")))
    .orderBy(asc(sessions.startedAt));
  if (sess.length === 0) return { skipped: "no-transcript" };

  const lines = await db.select().from(transcriptLines)
    .where(inArray(transcriptLines.sessionId, sess.map((s) => s.id)))
    .orderBy(asc(transcriptLines.startMs));
  if (lines.length === 0) return { skipped: "no-transcript" };

  const bySession = new Map<string, typeof lines>();
  for (const l of lines) { const a = bySession.get(l.sessionId) ?? []; a.push(l); bySession.set(l.sessionId, a); }
  const transcript = sess.map((s, i) => {
    const body = (bySession.get(s.id) ?? [])
      .map((l) => `[${l.speaker === "practitioner" ? "PRO" : "PATIENT"}] ${l.text}`).join("\n");
    return `## Consultation ${i + 1}\n${body}`;
  }).join("\n\n");

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CARE_MODEL, max_tokens: 4096,
    tools: [CARE_TOOL], tool_choice: { type: "tool", name: CARE_TOOL.name },
    messages: [{ role: "user", content: buildClinicianCarePrompt({ practitionerLabel: pro.fullName, transcript }) }],
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Pas d'appel d'outil");
  const parsed = block.input as Record<string, { score: number | null; rationale_fr: string | null; rationale_en: string | null }>;

  const values: Record<string, unknown> = {
    practitionerId, source: "ai", sessionsCount: sess.length,
    model: CARE_MODEL, promptVersion: CARE_PROMPT_VERSION, rawOutput: parsed,
  };
  const rationale: Record<string, { fr: string; en: string }> = {};
  for (const axis of CARE_AXES) {
    const a = parsed[axis];
    const s = a && typeof a.score === "number" && a.score >= 0 && a.score <= 100 ? Math.round(a.score) : null;
    values[COL[axis]] = s;
    if (a?.rationale_fr && a?.rationale_en) rationale[axis] = { fr: a.rationale_fr, en: a.rationale_en };
  }
  values.rationale = rationale;

  await db.insert(practitionerCareSnapshots).values(values as typeof practitionerCareSnapshots.$inferInsert)
    .onConflictDoUpdate({ target: practitionerCareSnapshots.practitionerId, set: { ...values, updatedAt: new Date() } });
  return { ok: true, practitionerId, sessionsCount: sess.length };
}
```

- [ ] **Step 3 :** `pnpm typecheck` → PASS. **Commit** `feat(care-quality): génération IA tool_use (clinicien)`.

---

## Task 5 — Scripts CLI (génération + seed équipe)

**Files:** Create `scripts/clinician-generate.ts`, `scripts/seed-care-team.ts`. Modify `package.json`. Pattern dotenv = `scripts/psy-rescore-all.ts`.

- [ ] **Step 1 : clinician-generate.ts**

```ts
import { config } from "dotenv";
config({ path: ".env.local", override: true });
(async () => {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const { db } = await import("../db/client");
  const { practitioners } = await import("../db/schema");
  const { generatePractitionerCareSnapshot } = await import("../lib/care-quality/generate");
  const { eq } = await import("drizzle-orm");
  let list = ids;
  if (list.length === 0) {
    const rows = await db.select({ id: practitioners.id }).from(practitioners).where(eq(practitioners.role, "audioprothesiste"));
    list = rows.map((r) => r.id);
  }
  for (const id of list) {
    const out = await generatePractitionerCareSnapshot(id);
    console.log(id.slice(0, 8), "→", JSON.stringify(out));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2 : seed-care-team.ts** — 3 praticiens fictifs (centre de Jonathan) + snapshots `source='seed'`. Idempotent (skip si fullName déjà présent ; upsert snapshot sur practitionerId).

```ts
import { config } from "dotenv";
config({ path: ".env.local", override: true });
(async () => {
  const { db } = await import("../db/client");
  const { practitioners, practitionerCareSnapshots, sessions } = await import("../db/schema");
  const { eq, and } = await import("drizzle-orm");

  // Centre = celui de Jonathan
  const [jonathan] = await db.select({ centerId: practitioners.centerId })
    .from(practitioners).where(eq(practitioners.fullName, "Jonathan Goldminc")).limit(1);
  if (!jonathan?.centerId) { console.error("Jonathan/centre introuvable"); process.exit(1); }
  const centerId = jonathan.centerId;

  const TEAM: Array<{ name: string; scores: [number, number, number, number, number, number] }> = [
    { name: "Camille Roche",  scores: [82, 64, 58, 71, 88, 55] },
    { name: "Marc Lefèvre",   scores: [70, 80, 66, 62, 74, 68] },
    { name: "Inès Khelifi",   scores: [90, 72, 49, 84, 60, 77] },
  ];

  for (const t of TEAM) {
    let [pro] = await db.select({ id: practitioners.id }).from(practitioners)
      .where(and(eq(practitioners.fullName, t.name), eq(practitioners.role, "audioprothesiste"))).limit(1);
    if (!pro) {
      [pro] = await db.insert(practitioners)
        .values({ fullName: t.name, role: "audioprothesiste", centerId })
        .returning({ id: practitioners.id });
    }
    const [r, p, s, g, f, a] = t.scores;
    const vals = {
      practitionerId: pro.id, rapportScore: r, pedagogyScore: p, structureScore: s,
      guidanceScore: g, followThroughScore: f, adaptabilityScore: a,
      rationale: null, source: "seed", sessionsCount: 0, model: null, promptVersion: null, rawOutput: null,
    } as typeof practitionerCareSnapshots.$inferInsert;
    await db.insert(practitionerCareSnapshots).values(vals)
      .onConflictDoUpdate({ target: practitionerCareSnapshots.practitionerId, set: vals });
    console.log("seed", t.name, "✓");
  }
  void sessions;
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3 : package.json** — ajouter après `relationship:generate` :
```json
    "clinician:generate": "tsx --conditions react-server scripts/clinician-generate.ts",
    "seed:care-team": "tsx --conditions react-server scripts/seed-care-team.ts",
```

- [ ] **Step 4 :** `pnpm typecheck` → PASS. **Commit** `feat(care-quality): scripts génération + seed équipe`. (Exécution en Task 9.)

---

## Task 6 — Radar SVG générique 6 axes

**Files:** Create `components/care/care-radar.tsx` (client). Radar dédié (on ne réutilise PAS `psychology-radar.tsx`, trop couplé à PSY_AXES). Échelle 0-100.

- [ ] **Step 1 : composant** — hexagone, 6 axes dans l'ordre `CARE_AXES`, layers (1 ou plusieurs), labels via locale.

Structure : viewBox 440×360, CX 220 CY 180 R 130 ; angles = `-π/2 + i*π/3` pour i=0..5 dans l'ordre `CARE_AXES` ; pour chaque layer, polygone des axes non-null (valeur/100) ; grid concentrique [0.25,0.5,0.75,1] ; contour hexagonal ; dots + valeur sur le dernier layer ; labels `CARE_LABEL_*` à R*1.18 (ancre selon x). Props :
```ts
type CareLayer = { key: string; radar: CareRadar; color: string; fillOpacity: number; strokeWidth: number };
export function CareRadar({ layers, size = 320 }: { layers: CareLayer[]; size?: number });
```
Couleurs : brand `#CC0641`. Réutiliser la logique géométrique de `psychology-radar.tsx` (pointFor, gridPolygon, skip null) mais sur `CARE_AXES` et division par 100.

- [ ] **Step 2 :** `pnpm typecheck && pnpm lint` (sur le fichier) → PASS. **Commit** `feat(care): radar SVG générique 6 axes`.

---

## Task 7 — Composants Clinician Insight + Manager Dashboard view

**Files:** Create `components/care/clinician-insight.tsx`, `components/care/manager-dashboard-view.tsx` (client).

- [ ] **Step 1 : clinician-insight.tsx** — props `{ radar: CareRadar; rationale: CareSnapshot["rationale"]; sessionsCount: number }`.
  Rendu : titre + sous-titre « miroir privé », **CareRadar** (1 layer), panneau détail par axe au clic (CARE_LABEL/SUB/CAPTURES/USED + la rationale IA de l'axe selon locale si présente), bandeau confidentialité (`t("clinicianInsight.privacy")`), footer chaîne de valeur (`t("clinicianInsight.valueChain")`). Tokens charte (brand, surface, border). i18n namespace `clinicianInsight`.

- [ ] **Step 2 : manager-dashboard-view.tsx** — props `{ teamRadar: CareRadar; distribution: Record<CareAxis, Record<CareTier, number>>; clinicianCount: number }`.
  Rendu : titre « L'équipe comme un actif », en-tête `t("managerDashboard.teamMeta", {count})`, **CareRadar** (teamRadar), bloc distribution (barres empilées par axe : signature/solid/developing avec 3 couleurs), bandeaux « Toujours agrégé » / « Jamais visible ». Aucune donnée nominative.

- [ ] **Step 3 :** `pnpm typecheck && pnpm lint` → PASS. **Commit** `feat(care): vues Clinician Insight + Manager Dashboard`.

---

## Task 8 — Câblage (dashboard, route admin, nav, i18n)

**Files:** Modify `app/page.tsx`, `lib/nav-config.ts`, `messages/*.json`; Create `app/admin/manager/page.tsx`.

- [ ] **Step 1 : i18n** — ajouter dans `messages/fr.json` et `messages/en.json` les namespaces `clinicianInsight` (title, subtitle, captures, usedTo, notThis, privacy, valueChain, axisDetail labels) et `managerDashboard` (title, teamMeta `"{count} cliniciens · fusionné, anonyme"`, distributionTitle, tiers signature/solid/developing, alwaysAggregated, neverVisible) + clé `nav.manager` (FR « Manager », EN « Manager »). (Reprendre les phrases des maquettes.)

- [ ] **Step 2 : nav-config.ts** — ajouter `"manager"` à `NavKey` et l'entrée :
```ts
{ key: "manager", href: "/admin/manager", icon: Users, roles: ["audioprothesiste", "assistant"] },
```
(importer une icône lucide, ex. `BarChart3`).

- [ ] **Step 3 : app/page.tsx** — pour le rôle `audioprothesiste`, charger le snapshot du praticien courant et rendre `<ClinicianInsight />` sous les KPIs :
```ts
import { getCurrentQuizPractitioner } from "@/lib/quiz-identity";
import { getPractitionerCareSnapshot } from "@/lib/care-quality/queries";
import { ClinicianInsight } from "@/components/care/clinician-insight";
// ... dans le composant (role audioprothesiste) :
const me = await getCurrentQuizPractitioner("audioprothesiste");
let care = null;
try { care = me ? await getPractitionerCareSnapshot(me.id) : null; } catch { care = null; }
// rendu si care : <ClinicianInsight radar={care.radar} rationale={care.rationale} sessionsCount={care.sessionsCount} />
```
(try/catch : la table peut ne pas être appliquée → pas de crash.)

- [ ] **Step 4 : app/admin/manager/page.tsx** (server) :
```tsx
import { getCurrentQuizPractitioner } from "@/lib/quiz-identity";
import { db } from "@/db/client";
import { practitioners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCenterCareSnapshots } from "@/lib/care-quality/queries";
import { computeTeamAverage, computeDistribution } from "@/lib/care-quality/aggregate";
import { ManagerDashboardView } from "@/components/care/manager-dashboard-view";

export const dynamic = "force-dynamic";
export default async function ManagerPage() {
  const me = await getCurrentQuizPractitioner("audioprothesiste");
  let snaps: Awaited<ReturnType<typeof getCenterCareSnapshots>> = [];
  if (me) {
    const [pro] = await db.select({ centerId: practitioners.centerId }).from(practitioners).where(eq(practitioners.id, me.id)).limit(1);
    if (pro?.centerId) { try { snaps = await getCenterCareSnapshots(pro.centerId); } catch { snaps = []; } }
  }
  return <ManagerDashboardView teamRadar={computeTeamAverage(snaps)} distribution={computeDistribution(snaps)} clinicianCount={snaps.length} />;
}
```
Envelopper dans le layout/PageHeader selon le pattern des autres pages `/admin/*`.

- [ ] **Step 5 :** `pnpm typecheck && pnpm build` → PASS. **Commit** `feat(care): câblage dashboard + route admin manager + nav + i18n`.

---

## Task 9 — Génération démo + vérif E2E + non-régression

- [ ] **Step 1 : seed équipe** — `pnpm seed:care-team` → 3 praticiens fictifs + snapshots seed.
- [ ] **Step 2 : génération Jonathan** — `pnpm clinician:generate` → snapshot IA (6 axes + rationale FR/EN). Vérifier en base via Supabase MCP `execute_sql` (project `geyyfrqloisqgfmapqjk`) que la ligne `source='ai'` a 6 scores et `rationale` bilingue.
- [ ] **Step 3 : dev** — `PORT=3210 pnpm dev`, cookie `clinic_os_user=Jonathan`. Vérifier :
  - Dashboard `/` (audioprothésiste) : section Clinician Insight = radar 6 axes + détail au clic + bandeau confidentialité, en FR et EN.
  - `/admin/manager` : radar agrégé + distribution 4 cliniciens + bandeaux, aucune donnée nominative.
- [ ] **Step 4 : non-régression** — dashboard KPIs existants, page patient (4 onglets), liste patients, export → toujours 200. `pnpm build` → PASS.
- [ ] **Step 5 : commit + push** (si demandé par l'utilisateur).

---

## Self-Review

- Spec couvert : table additive ✅ (T1) ; 6 axes FR/EN ✅ (T2) ; Clinician réel IA ✅ (T4, T8s3) ; Manager seedé agrégé ✅ (T3, T5s2, T8s4) ; radar ✅ (T6) ; bilingue rationale ✅ (T4) ; accès dashboard + admin ✅ (T8) ; identité via getCurrentQuizPractitioner ✅ ; confidentialité/garde-fous ✅ (T7) ; équipe de 4 ✅ (T5).
- Placeholders : aucun (copie statique fournie ; les seuls éléments « selon pattern » renvoient à des fichiers existants précis).
- Cohérence types : `CareAxis`/`CareRadar`/`CareSnapshot`/`CareTier` définis en T2 et réutilisés partout ; colonnes DB ↔ `COL` map en T4 ; `tierFor` seuils (75/50) cohérents T2↔T3.
- Hors scope (rôle manager réel, IA équipe, historique) non inclus. ✅
