# Profil psychologique patient — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un profil psychologique patient (radar 6 axes, scoring IA auto par session, agrégat global, tags rules-based, consentement RGPD à 2 niveaux, exports CSV ciblés et liste actionnable côté pro) — tout intégré dans le pipeline d'analyse existant et les pages patient/admin/dashboard.

**Architecture:** Étape de scoring parallèle injectée à la fin du pipeline d'analyse de session (`lib/analysis/analyze.ts`). Snapshots persistés en table dédiée, agrégés en TS via la règle « plus récent observé par axe ». Tags rules-based calculés à l'INSERT. UI : carte radar SVG multi-couches sur la page patient, page admin avec filtres + export CSV, section dashboard pro alimentée par les tags actionnables. Consentement marketing à 2 niveaux avec audit trail.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Postgres (Supabase), Claude Sonnet 4.5 (`claude-sonnet-4-5`), TypeScript strict, shadcn/ui, Tailwind, lucide-react.

---

## Reference

- Spec : [docs/superpowers/specs/2026-05-08-patient-psychology-design.md](../specs/2026-05-08-patient-psychology-design.md)
- Pattern de constantes typées à suivre : [lib/phone-tags.ts](../../../lib/phone-tags.ts)
- Pipeline d'analyse à étendre : [lib/analysis/analyze.ts:64-200](../../../lib/analysis/analyze.ts)
- Schéma DB : [db/schema.ts](../../../db/schema.ts) (fichier monolithique, ajouter à la fin)
- Page patient à modifier : [app/patients/[id]/page.tsx](../../../app/patients/[id]/page.tsx)

## Vocabulaire

- **Snapshot** = ligne de `session_psychology_snapshots`, 1 par session
- **Radar global** = vue calculée en TS depuis les snapshots d'un patient (« plus récent observé par axe »)
- **Tag** = string slug en kebab-case (`prospect-chaud`, `réfractaire-prix`, …) ; un patient peut en avoir plusieurs
- **Sessions kind** = `'consultation' | 'phone_call'` (vocabulaire existant, pas `appel`)

## File Structure

**Nouveaux fichiers :**

| Fichier | Responsabilité |
|---|---|
| `lib/psychology/axes.ts` | Constante `PSY_AXES` (6 axes + labels FR/EN) + types `PsyAxis`, `PsyRadar`, `PsySnapshot` |
| `lib/psychology/tags.ts` | Constante `PSY_TAG_RULES` + fonction `computeTags(radar)` |
| `lib/psychology/actions.ts` | Map `PSY_TAG_ACTIONS` (tag → suggestion d'action FR/EN) |
| `lib/psychology/aggregate.ts` | Fonction `computeGlobalRadar(snapshots)` |
| `lib/psychology/prompt.ts` | Constante `PSY_PROMPT_TEMPLATE` + `PSY_PROMPT_VERSION` |
| `lib/psychology/score-session.ts` | Fonction `scorePatientPsychology(sessionId)` — orchestration Claude + persist |
| `lib/psychology/queries.ts` | Helpers DB : `getPatientSnapshots`, `getPatientGlobalRadar`, `searchByTags` |
| `lib/psychology/consent.ts` | `hasActiveMarketingConsent`, `setConsent`, `revokeConsent` |
| `lib/psychology/format-csv.ts` | `formatPsychologyCsv(rows)` |
| `app/admin/psychology/page.tsx` | Page admin (server component) |
| `app/admin/psychology/export/route.ts` | Endpoint API GET pour export CSV |
| `app/actions/psychology.ts` | Server actions (toggle consentement, log export) |
| `components/patients/psychology-radar.tsx` | Composant SVG (multi-polygones, axes, labels) |
| `components/patients/psychology-radar-card.tsx` | Wrapper card : toggle + légende + tags |
| `components/patients/marketing-consent-toggle.tsx` | Switch consentement |
| `components/admin/psychology-filters.tsx` | Barre de filtres (tags, consent, dates) |
| `components/admin/psychology-table.tsx` | Tableau avec checkbox + mini-radar thumbnail |
| `components/dashboard/recall-list.tsx` | Section « Patients à recontacter » |
| `scripts/psy-score-session.ts` | CLI dry-run — calibration Jonathan |
| `scripts/psy-rescore-all.ts` | Recalcul tous snapshots seed |

**Fichiers modifiés :**

| Fichier | Changement |
|---|---|
| `db/schema.ts` | + table `sessionPsychologySnapshots`, + colonnes consent sur `patients`, + tables `consentAuditLog` + `psychologyExportLog` |
| `lib/analysis/analyze.ts` | Appel `scorePatientPsychology(sessionId)` en post-success (try/catch isolé) |
| `app/patients/[id]/page.tsx` | Intégration `<PsychologyRadarCard>` + `<MarketingConsentToggle>` |
| `app/page.tsx` | Intégration `<RecallList>` dans le dashboard |
| `lib/patients.ts` ou nouveau `lib/patients-psychology.ts` | Helper `getPatientPsychologyForDetail()` |
| `package.json` | + scripts `psy:score-session`, `psy:rescore-all` |

---

## Phase 1 — Foundation : schéma + types

### Task 1 : Ajouter les tables au schéma Drizzle

**Files:**
- Modify: `db/schema.ts` (à la fin du fichier, avant la dernière export si elle existe)

- [ ] **Step 1: Ajouter les imports manquants en haut de db/schema.ts**

Vérifier que `smallint` est importé depuis `drizzle-orm/pg-core`. S'il manque, l'ajouter à la liste d'imports existante :

```typescript
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,  // ← AJOUTER si absent
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Ajouter les colonnes consent à la table `patients`**

Localiser la définition de `export const patients = pgTable(...)` (vers la ligne 111). Ajouter 2 colonnes dans l'objet de définition, juste avant `createdAt` :

```typescript
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    age: integer("age"),
    status: text("status").notNull().default("prospect"),
    firstContactAt: timestamp("first_contact_at", { withTimezone: true }),
    centerId: uuid("center_id").references(() => centers.id),
    marketingPsyConsentAt: timestamp("marketing_psy_consent_at", { withTimezone: true }),
    marketingPsyRevokedAt: timestamp("marketing_psy_revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  // ... checks inchangés
);
```

- [ ] **Step 3: Ajouter la table `sessionPsychologySnapshots` à la fin du fichier**

```typescript
// ==================================================================
// 16. Session psychology snapshots (1 par session, IA auto post-analyse)
// ==================================================================
export const sessionPsychologySnapshots = pgTable(
  "session_psychology_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    acceptanceScore: smallint("acceptance_score"),
    motivationScore: smallint("motivation_score"),
    trustScore: smallint("trust_score"),
    priceSensitivityScore: smallint("price_sensitivity_score"),
    externalInfluenceScore: smallint("external_influence_score"),
    decisionStageScore: smallint("decision_stage_score"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    rawOutput: jsonb("raw_output").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("session_psychology_session_unique").on(t.sessionId),
    index("session_psychology_patient_idx").on(t.patientId, t.createdAt),
    // GIN index sur tags ajouté manuellement dans la migration SQL (Drizzle ne génère pas GIN)
  ]
);
```

- [ ] **Step 4: Ajouter les 2 tables d'audit RGPD**

```typescript
// ==================================================================
// 17. Consent audit log (RGPD)
// ==================================================================
export const consentAuditLog = pgTable(
  "consent_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    scope: text("scope").notNull(),
    actorId: uuid("actor_id").references(() => practitioners.id),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("consent_audit_action_check", sql`${t.action} in ('granted', 'revoked')`),
    check("consent_audit_scope_check", sql`${t.scope} in ('marketing_psy')`),
    check("consent_audit_source_check", sql`${t.source} in ('patient_page', 'admin', 'api')`),
    index("consent_audit_patient_idx").on(t.patientId, t.createdAt),
  ]
);

// ==================================================================
// 18. Psychology export log (RGPD)
// ==================================================================
export const psychologyExportLog = pgTable(
  "psychology_export_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => practitioners.id),
    patientCount: integer("patient_count").notNull(),
    filters: jsonb("filters").notNull(),
    overrideNonConsenting: boolean("override_non_consenting").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("psy_export_actor_idx").on(t.actorId, t.createdAt),
  ]
);
```

- [ ] **Step 5: Vérifier la compilation du schéma**

Run:
```bash
pnpm typecheck
```

Expected: aucune erreur TS dans `db/schema.ts`. Si erreurs, vérifier que `smallint` et `boolean` sont bien importés.

- [ ] **Step 6: Générer la migration Drizzle**

Run:
```bash
pnpm db:generate
```

Expected: création d'un nouveau fichier `drizzle/0004_*.sql` qui contient :
- ALTER TABLE patients ADD COLUMN marketing_psy_consent_at, marketing_psy_revoked_at
- CREATE TABLE session_psychology_snapshots avec ses checks/index
- CREATE TABLE consent_audit_log
- CREATE TABLE psychology_export_log

Si la migration manque le GIN index, l'ajouter manuellement à la fin du SQL généré :

```sql
CREATE INDEX IF NOT EXISTS session_psychology_tags_gin_idx
  ON session_psychology_snapshots USING GIN(tags);
```

- [ ] **Step 7: Appliquer la migration localement**

Run:
```bash
pnpm db:migrate
```

Expected: « Migrations applied successfully » (ou équivalent). Vérifier dans Supabase Studio qu'on voit :
- `patients.marketing_psy_consent_at` (timestamp nullable)
- Table `session_psychology_snapshots`
- Table `consent_audit_log`
- Table `psychology_export_log`

- [ ] **Step 8: Commit**

```bash
git add db/schema.ts drizzle/
git commit -m "feat(psy): schema profil psychologique patient + audit RGPD

- session_psychology_snapshots (1 ligne par session, 6 axes 0-10, tags array, raw_output JSONB)
- patients.marketing_psy_consent_at + marketing_psy_revoked_at
- consent_audit_log + psychology_export_log (audit RGPD)

Cf. spec: docs/superpowers/specs/2026-05-08-patient-psychology-design.md §5"
```

---

### Task 2 : Définir les axes, types et règles de tags

**Files:**
- Create: `lib/psychology/axes.ts`
- Create: `lib/psychology/tags.ts`
- Create: `lib/psychology/actions.ts`

- [ ] **Step 1: Créer `lib/psychology/axes.ts`**

```typescript
/**
 * 6 axes psychologiques scorés par l'IA depuis le transcript de chaque session.
 * Échelle 0-10. Score null si l'axe n'est pas observable dans la session.
 * Cf. spec: docs/superpowers/specs/2026-05-08-patient-psychology-design.md §3
 */

export const PSY_AXES = [
  "acceptance",
  "motivation",
  "trust",
  "priceSensitivity",
  "externalInfluence",
  "decisionStage",
] as const;

export type PsyAxis = (typeof PSY_AXES)[number];

export const PSY_AXIS_LABEL: Record<PsyAxis, string> = {
  acceptance: "Acceptation déficit",
  motivation: "Motivation",
  trust: "Confiance pro",
  priceSensitivity: "Sensibilité prix",
  externalInfluence: "Influence entourage",
  decisionStage: "Stade décisionnel",
};

export const PSY_AXIS_LABEL_EN: Record<PsyAxis, string> = {
  acceptance: "Hearing loss acceptance",
  motivation: "Motivation",
  trust: "Practitioner trust",
  priceSensitivity: "Price sensitivity",
  externalInfluence: "External influence",
  decisionStage: "Decision stage",
};

export const PSY_AXIS_DESCRIPTION: Record<PsyAxis, string> = {
  acceptance: "Reconnaissance et acceptation du problème auditif (0 = déni, 10 = pleinement accepté)",
  motivation: "Énergie d'engagement dans le traitement (0 = passif, 10 = moteur)",
  trust: "Niveau de confiance accordé à l'audioprothésiste (0 = méfiance, 10 = confiance totale)",
  priceSensitivity: "Importance du frein financier (0 = peu sensible, 10 = très sensible)",
  externalInfluence: "Rôle décisionnel de l'entourage (0 = autonome, 10 = entourage déterminant)",
  decisionStage: "Avancement dans le parcours (0 = exploration, 10 = prêt à signer)",
};

export type PsyRadar = Record<PsyAxis, number | null>;

export type PsySnapshot = {
  id: string;
  sessionId: string;
  patientId: string;
  radar: PsyRadar;
  tags: string[];
  rawOutput: unknown;
  promptVersion: string;
  model: string;
  createdAt: Date;
};

/** Snapshot column name in DB ↔ axis key in TS. Used by query mappers. */
export const PSY_AXIS_COLUMN: Record<PsyAxis, string> = {
  acceptance: "acceptance_score",
  motivation: "motivation_score",
  trust: "trust_score",
  priceSensitivity: "price_sensitivity_score",
  externalInfluence: "external_influence_score",
  decisionStage: "decision_stage_score",
};
```

- [ ] **Step 2: Créer `lib/psychology/tags.ts` avec les 10 règles**

```typescript
import type { PsyRadar } from "./axes";

/**
 * Tags marketing dérivés des seuils sur les 6 axes psychologiques.
 * Un patient peut avoir plusieurs tags simultanément.
 * Si un axe est null, toute règle qui en dépend est ignorée.
 * Cf. spec §6.2.
 */

export const PSY_TAGS = [
  "prospect-chaud",
  "prospect-froid",
  "réfractaire-prix",
  "en-déni",
  "entourage-décisif",
  "méfiant",
  "décisionnaire-éclairé",
  "à-rassurer",
  "à-éduquer",
  "prêt-conversion",
] as const;

export type PsyTag = (typeof PSY_TAGS)[number];

export const PSY_TAG_LABEL: Record<PsyTag, string> = {
  "prospect-chaud": "Prospect chaud",
  "prospect-froid": "Prospect froid",
  "réfractaire-prix": "Réfractaire prix",
  "en-déni": "En déni",
  "entourage-décisif": "Entourage décisif",
  "méfiant": "Méfiant",
  "décisionnaire-éclairé": "Décisionnaire éclairé",
  "à-rassurer": "À rassurer",
  "à-éduquer": "À éduquer",
  "prêt-conversion": "Prêt conversion",
};

type Rule = {
  tag: PsyTag;
  test: (r: PsyRadar) => boolean;
};

const all = (...vals: (number | null | undefined)[]) =>
  vals.every((v) => v !== null && v !== undefined);

export const PSY_TAG_RULES: ReadonlyArray<Rule> = [
  // Ordre = priorité d'affichage UI quand on affiche un sous-ensemble
  { tag: "prospect-chaud", test: (r) => all(r.decisionStage, r.motivation) && r.decisionStage! >= 7 && r.motivation! >= 7 },
  { tag: "prêt-conversion", test: (r) => all(r.decisionStage, r.priceSensitivity) && r.decisionStage! >= 8 && r.priceSensitivity! <= 5 },
  { tag: "réfractaire-prix", test: (r) => all(r.priceSensitivity, r.decisionStage) && r.priceSensitivity! >= 7 && r.decisionStage! <= 5 },
  { tag: "à-rassurer", test: (r) => all(r.trust, r.motivation) && r.trust! <= 4 && r.motivation! >= 5 },
  { tag: "méfiant", test: (r) => r.trust !== null && r.trust !== undefined && r.trust <= 3 },
  { tag: "en-déni", test: (r) => r.acceptance !== null && r.acceptance !== undefined && r.acceptance <= 3 },
  { tag: "entourage-décisif", test: (r) => r.externalInfluence !== null && r.externalInfluence !== undefined && r.externalInfluence >= 7 },
  { tag: "décisionnaire-éclairé", test: (r) => all(r.decisionStage, r.acceptance, r.motivation) && r.decisionStage! >= 6 && r.acceptance! >= 6 && r.motivation! >= 6 },
  { tag: "à-éduquer", test: (r) => all(r.acceptance, r.decisionStage) && r.acceptance! <= 5 && r.decisionStage! <= 4 },
  { tag: "prospect-froid", test: (r) => all(r.decisionStage, r.motivation) && r.decisionStage! <= 3 && r.motivation! <= 4 },
];

export function computeTags(radar: PsyRadar): PsyTag[] {
  return PSY_TAG_RULES.filter((rule) => rule.test(radar)).map((r) => r.tag);
}
```

- [ ] **Step 3: Créer `lib/psychology/actions.ts`**

```typescript
import type { PsyTag } from "./tags";

/**
 * Suggestion d'action pour le pro quand un patient a ce tag.
 * Utilisé dans la section "Patients à recontacter" du dashboard.
 */
export const PSY_TAG_ACTIONS: Record<PsyTag, { fr: string; en: string; priority: number }> = {
  "prêt-conversion":     { fr: "Demander la signature, push offre",        en: "Push offer, ask for signature",       priority: 100 },
  "prospect-chaud":      { fr: "Proposer rendez-vous d'essai cette semaine", en: "Schedule trial appointment this week", priority: 90 },
  "réfractaire-prix":    { fr: "Proposer simulation financement / mutuelle", en: "Offer financing / insurance simulation", priority: 80 },
  "à-rassurer":          { fr: "Audit second avis offert, contact référent", en: "Offer second-opinion audit, dedicated contact", priority: 70 },
  "entourage-décisif":   { fr: "Proposer 2e RDV avec accompagnant",        en: "Schedule second appointment with companion", priority: 60 },
  "décisionnaire-éclairé": { fr: "Comparatif technique, démo premium",      en: "Technical comparison, premium demo",   priority: 50 },
  "à-éduquer":           { fr: "Inviter à un atelier découverte / webinaire", en: "Invite to discovery workshop / webinar", priority: 40 },
  "méfiant":             { fr: "Transparence renforcée, témoignages",       en: "Enhanced transparency, testimonials",  priority: 30 },
  "en-déni":             { fr: "Témoignages patients, désamorcer le déni",  en: "Patient testimonials, defuse denial",  priority: 20 },
  "prospect-froid":      { fr: "Nurturing long terme, contenu pédagogique", en: "Long-term nurturing, educational content", priority: 10 },
};

export const ACTIONABLE_TAGS: ReadonlyArray<PsyTag> = [
  "prêt-conversion",
  "prospect-chaud",
  "réfractaire-prix",
  "à-rassurer",
];
```

- [ ] **Step 4: Vérifier le typecheck**

Run:
```bash
pnpm typecheck
```

Expected: aucune erreur dans les nouveaux fichiers `lib/psychology/*.ts`.

- [ ] **Step 5: Smoke-test des règles de tags**

Créer un fichier temporaire `scripts/psy-test-tags.ts` :

```typescript
import { computeTags } from "../lib/psychology/tags";

const cases: Array<{ name: string; radar: any; expected: string[] }> = [
  { name: "prospect chaud + prêt-conversion", radar: { acceptance: 7, motivation: 8, trust: 8, priceSensitivity: 3, externalInfluence: 4, decisionStage: 9 }, expected: ["prospect-chaud", "prêt-conversion", "décisionnaire-éclairé"] },
  { name: "réfractaire prix", radar: { acceptance: 6, motivation: 5, trust: 6, priceSensitivity: 8, externalInfluence: 4, decisionStage: 4 }, expected: ["réfractaire-prix"] },
  { name: "tous null", radar: { acceptance: null, motivation: null, trust: null, priceSensitivity: null, externalInfluence: null, decisionStage: null }, expected: [] },
  { name: "acceptance partielle", radar: { acceptance: 2, motivation: null, trust: null, priceSensitivity: null, externalInfluence: null, decisionStage: null }, expected: ["en-déni"] },
];

let pass = 0;
for (const c of cases) {
  const got = computeTags(c.radar).sort();
  const want = [...c.expected].sort();
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(ok ? "✓" : "✗", c.name, "→", got);
  if (!ok) console.log("  expected:", want);
  if (ok) pass++;
}
console.log(`\n${pass}/${cases.length} pass`);
process.exit(pass === cases.length ? 0 : 1);
```

Run:
```bash
pnpm tsx scripts/psy-test-tags.ts
```

Expected: `4/4 pass`. Si fail, corriger les seuils dans `lib/psychology/tags.ts` ou les cases du test.

- [ ] **Step 6: Supprimer le test temporaire et commit**

```bash
rm scripts/psy-test-tags.ts
git add lib/psychology/
git commit -m "feat(psy): axes, types, tag rules et actions suggérées

- 6 axes (acceptance, motivation, trust, priceSensitivity, externalInfluence, decisionStage)
- 10 tags rules-based avec test de seuils, multi-tag par snapshot
- Map d'actions suggérées pour la section dashboard 'Patients à recontacter'"
```

---

### Task 3 : Implémenter l'agrégation globale et les helpers consent

**Files:**
- Create: `lib/psychology/aggregate.ts`
- Create: `lib/psychology/consent.ts`
- Create: `lib/psychology/queries.ts`

- [ ] **Step 1: Créer `lib/psychology/aggregate.ts`**

```typescript
import { PSY_AXES, type PsyAxis, type PsyRadar, type PsySnapshot } from "./axes";
import { computeTags, type PsyTag } from "./tags";

/**
 * Calcule le radar global d'un patient depuis tous ses snapshots de session.
 * Règle: pour chaque axe, on prend la valeur non-null la plus récente parmi
 * tous les snapshots du patient (cf. spec §6.3).
 */
export function computeGlobalRadar(snapshots: PsySnapshot[]): PsyRadar {
  const ordered = [...snapshots].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const radar = {} as PsyRadar;
  for (const axis of PSY_AXES) {
    const found = ordered.find((s) => s.radar[axis] !== null && s.radar[axis] !== undefined);
    radar[axis] = found?.radar[axis] ?? null;
  }
  return radar;
}

/**
 * Trouve le snapshot source d'un axe pour le radar global. Utilisé pour le
 * tooltip de hover (afficher la rationale + citation issues du bon snapshot).
 */
export function findSnapshotForAxis(
  axis: PsyAxis,
  snapshots: PsySnapshot[]
): PsySnapshot | null {
  const ordered = [...snapshots].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return ordered.find((s) => s.radar[axis] !== null && s.radar[axis] !== undefined) ?? null;
}

/**
 * Tags du global = recalculés depuis le radar global agrégé (pas la concaténation
 * des tags individuels). Garantit cohérence avec l'affichage et l'export.
 */
export function computeGlobalTags(snapshots: PsySnapshot[]): PsyTag[] {
  return computeTags(computeGlobalRadar(snapshots));
}
```

- [ ] **Step 2: Créer `lib/psychology/consent.ts`**

```typescript
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, consentAuditLog } from "@/db/schema";

export type Patient = typeof patients.$inferSelect;

export function hasActiveMarketingConsent(p: {
  marketingPsyConsentAt: Date | null;
  marketingPsyRevokedAt: Date | null;
}): boolean {
  if (!p.marketingPsyConsentAt) return false;
  if (!p.marketingPsyRevokedAt) return true;
  // Reconsentement après révocation: consent_at > revoked_at
  return p.marketingPsyConsentAt.getTime() > p.marketingPsyRevokedAt.getTime();
}

export async function grantMarketingConsent(opts: {
  patientId: string;
  actorId: string | null;
  source: "patient_page" | "admin" | "api";
}): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({ marketingPsyConsentAt: now, marketingPsyRevokedAt: null })
      .where(eq(patients.id, opts.patientId));
    await tx.insert(consentAuditLog).values({
      patientId: opts.patientId,
      action: "granted",
      scope: "marketing_psy",
      actorId: opts.actorId,
      source: opts.source,
    });
  });
}

export async function revokeMarketingConsent(opts: {
  patientId: string;
  actorId: string | null;
  source: "patient_page" | "admin" | "api";
}): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({ marketingPsyRevokedAt: now })
      .where(eq(patients.id, opts.patientId));
    await tx.insert(consentAuditLog).values({
      patientId: opts.patientId,
      action: "revoked",
      scope: "marketing_psy",
      actorId: opts.actorId,
      source: opts.source,
    });
  });
}
```

- [ ] **Step 3: Créer `lib/psychology/queries.ts`**

```typescript
import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sessionPsychologySnapshots, patients } from "@/db/schema";
import { PSY_AXES, type PsyRadar, type PsySnapshot } from "./axes";

type SnapshotRow = typeof sessionPsychologySnapshots.$inferSelect;

function rowToSnapshot(row: SnapshotRow): PsySnapshot {
  const radar = {} as PsyRadar;
  radar.acceptance = row.acceptanceScore;
  radar.motivation = row.motivationScore;
  radar.trust = row.trustScore;
  radar.priceSensitivity = row.priceSensitivityScore;
  radar.externalInfluence = row.externalInfluenceScore;
  radar.decisionStage = row.decisionStageScore;
  return {
    id: row.id,
    sessionId: row.sessionId,
    patientId: row.patientId,
    radar,
    tags: row.tags,
    rawOutput: row.rawOutput,
    promptVersion: row.promptVersion,
    model: row.model,
    createdAt: row.createdAt,
  };
}

/** Tous les snapshots d'un patient, du plus récent au plus ancien. */
export async function getPatientSnapshots(patientId: string): Promise<PsySnapshot[]> {
  const rows = await db
    .select()
    .from(sessionPsychologySnapshots)
    .where(eq(sessionPsychologySnapshots.patientId, patientId))
    .orderBy(desc(sessionPsychologySnapshots.createdAt));
  return rows.map(rowToSnapshot);
}

/** Snapshot d'une session précise (unique par session_id). */
export async function getSessionSnapshot(sessionId: string): Promise<PsySnapshot | null> {
  const rows = await db
    .select()
    .from(sessionPsychologySnapshots)
    .where(eq(sessionPsychologySnapshots.sessionId, sessionId))
    .limit(1);
  return rows[0] ? rowToSnapshot(rows[0]) : null;
}

/**
 * Patients dont le snapshot le plus récent contient au moins un des tags donnés.
 * Si requireConsent=true, filtre sur consentement marketing actif.
 */
export async function searchPatientsByTags(opts: {
  tags: string[];
  requireConsent: boolean;
  centerId?: string | null;
  daysSinceLastSession?: number; // ex. 7 = "pas de session depuis ≥ 7 jours"
}): Promise<Array<{
  patientId: string;
  patientLabel: string;
  centerId: string | null;
  lastSessionAt: Date;
  tags: string[];
  consentAt: Date | null;
}>> {
  // Sous-requête : snapshot le plus récent par patient
  const latest = db
    .select({
      patientId: sessionPsychologySnapshots.patientId,
      maxAt: sql<Date>`max(${sessionPsychologySnapshots.createdAt})`.as("max_at"),
    })
    .from(sessionPsychologySnapshots)
    .groupBy(sessionPsychologySnapshots.patientId)
    .as("latest");

  const conditions = [
    sql`${sessionPsychologySnapshots.tags} && ${opts.tags}::text[]`,
  ];
  if (opts.requireConsent) {
    conditions.push(sql`${patients.marketingPsyConsentAt} IS NOT NULL`);
    conditions.push(sql`(${patients.marketingPsyRevokedAt} IS NULL OR ${patients.marketingPsyConsentAt} > ${patients.marketingPsyRevokedAt})`);
  }
  if (opts.centerId) {
    conditions.push(eq(patients.centerId, opts.centerId));
  }
  if (opts.daysSinceLastSession) {
    const cutoff = new Date(Date.now() - opts.daysSinceLastSession * 24 * 3600 * 1000);
    conditions.push(sql`${latest.maxAt} <= ${cutoff}`);
  }

  const rows = await db
    .select({
      patientId: patients.id,
      patientLabel: patients.label,
      centerId: patients.centerId,
      lastSessionAt: latest.maxAt,
      tags: sessionPsychologySnapshots.tags,
      consentAt: patients.marketingPsyConsentAt,
    })
    .from(sessionPsychologySnapshots)
    .innerJoin(latest, and(
      eq(sessionPsychologySnapshots.patientId, latest.patientId),
      eq(sessionPsychologySnapshots.createdAt, latest.maxAt),
    ))
    .innerJoin(patients, eq(patients.id, sessionPsychologySnapshots.patientId))
    .where(and(...conditions))
    .orderBy(desc(latest.maxAt));

  return rows;
}
```

- [ ] **Step 4: Vérifier compilation**

Run:
```bash
pnpm typecheck
```

Expected: pas d'erreur. Si erreur sur `latest.maxAt` (Drizzle aliasing), simplifier en deux requêtes séquentielles plutôt que sous-requête (acceptable, on a peu de patients en démo).

- [ ] **Step 5: Commit**

```bash
git add lib/psychology/
git commit -m "feat(psy): aggregation globale + helpers consent + queries DB

- computeGlobalRadar: 'plus récent observé par axe' depuis snapshots
- consent: hasActiveMarketingConsent + grant/revoke avec audit log
- queries: getPatientSnapshots, getSessionSnapshot, searchPatientsByTags"
```

---

## Phase 2 — Scoring pipeline + CLI calibration

### Task 4 : Prompt template + appel Claude

**Files:**
- Create: `lib/psychology/prompt.ts`
- Create: `lib/psychology/score-session.ts`

- [ ] **Step 1: Créer `lib/psychology/prompt.ts`**

```typescript
import { PSY_AXES, PSY_AXIS_LABEL, PSY_AXIS_DESCRIPTION, type PsyAxis } from "./axes";

export const PSY_PROMPT_VERSION = "psy-v1";
export const PSY_MODEL = "claude-sonnet-4-5" as const;

const AXIS_BLOCK = PSY_AXES.map((axis) => {
  return `- "${axis}" — ${PSY_AXIS_LABEL[axis]} : ${PSY_AXIS_DESCRIPTION[axis]}`;
}).join("\n");

const JSON_SHAPE = `{
  "axes": {
${PSY_AXES.map((a) => `    "${a}": {"score": <0-10 ou null>, "rationale": "<1-2 phrases>", "citation": "<extrait du transcript ou null>"}`).join(",\n")}
  },
  "observed_keywords": ["<mot-clé émotionnel>", "..."]
}`;

export function buildPsyPrompt(opts: {
  transcript: string;
  sessionKind: "consultation" | "phone_call";
  durationSeconds: number | null;
}): string {
  const kindLabel = opts.sessionKind === "phone_call" ? "appel téléphonique entrant" : "consultation";
  const duration = opts.durationSeconds ? `${Math.round(opts.durationSeconds / 60)} min` : "durée inconnue";

  return `Tu es un analyste comportemental spécialisé dans le parcours patient en audioprothèse.

À partir du transcript ci-dessous (${kindLabel}, ${duration}), score le PATIENT (pas le professionnel) sur 6 axes psychologiques. Échelle 0-10.

Axes:
${AXIS_BLOCK}

Règles strictes:
- Score un axe seulement si tu as au moins 2 indices observables dans le transcript pour cet axe
- Score null si l'axe n'est pas observable dans cette interaction (typique sur un appel court)
- Pour chaque axe scoré, donne 1-2 phrases de rationale + 1 citation EXACTE extraite du transcript
- N'infère pas au-delà du transcript (ne pas supposer d'âge, d'antécédents, etc.)
- Coache le patient, pas le professionnel: ses dispositions, doutes, ouverture, freins
- Réponds UNIQUEMENT avec un JSON valide, sans préambule ni markdown

Format de sortie JSON STRICT:
${JSON_SHAPE}

Transcript:
---
${opts.transcript}
---`;
}
```

- [ ] **Step 2: Créer `lib/psychology/score-session.ts`**

```typescript
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  transcriptLines,
  sessionPsychologySnapshots,
} from "@/db/schema";
import { getAnthropic } from "@/lib/claude";
import { PSY_AXES, type PsyRadar } from "./axes";
import { computeTags } from "./tags";
import { buildPsyPrompt, PSY_PROMPT_VERSION, PSY_MODEL } from "./prompt";

export type ScorePsyOutcome =
  | { ok: true; snapshotId: string; radar: PsyRadar; tags: string[] }
  | { skipped: "no-patient" | "no-transcript" | "no-content" };

const AXIS_TO_COL = {
  acceptance: "acceptanceScore",
  motivation: "motivationScore",
  trust: "trustScore",
  priceSensitivity: "priceSensitivityScore",
  externalInfluence: "externalInfluenceScore",
  decisionStage: "decisionStageScore",
} as const;

type RawAxis = { score: number | null; rationale: string | null; citation: string | null };
type RawOutput = {
  axes: Record<string, RawAxis>;
  observed_keywords?: string[];
};

export async function scorePatientPsychology(
  sessionId: string,
  options: { dryRun?: boolean } = {}
): Promise<ScorePsyOutcome> {
  const sess = await db
    .select({
      id: sessions.id,
      kind: sessions.kind,
      patientId: sessions.patientId,
      durationSeconds: sessions.durationSeconds,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!sess[0]) return { skipped: "no-patient" };
  const session = sess[0];
  if (!session.patientId) return { skipped: "no-patient" };

  const lines = await db
    .select()
    .from(transcriptLines)
    .where(eq(transcriptLines.sessionId, sessionId))
    .orderBy(asc(transcriptLines.startMs));

  if (lines.length === 0) return { skipped: "no-transcript" };

  const transcriptText = lines
    .map((l) => `[${l.speaker === "patient" ? "PATIENT" : "PRO"}] ${l.text}`)
    .join("\n");

  if (transcriptText.trim().length < 100) return { skipped: "no-content" };

  const prompt = buildPsyPrompt({
    transcript: transcriptText,
    sessionKind: session.kind as "consultation" | "phone_call",
    durationSeconds: session.durationSeconds,
  });

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: PSY_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("psy-score: réponse Claude vide");
  }
  const raw: RawOutput = JSON.parse(stripMarkdownFence(textBlock.text));

  const radar = {} as PsyRadar;
  for (const axis of PSY_AXES) {
    const v = raw.axes?.[axis]?.score;
    radar[axis] = typeof v === "number" && v >= 0 && v <= 10 ? Math.round(v) : null;
  }
  const tags = computeTags(radar);

  if (options.dryRun) {
    return { ok: true, snapshotId: "(dry-run)", radar, tags };
  }

  const inserted = await db
    .insert(sessionPsychologySnapshots)
    .values({
      sessionId: session.id,
      patientId: session.patientId,
      acceptanceScore: radar.acceptance,
      motivationScore: radar.motivation,
      trustScore: radar.trust,
      priceSensitivityScore: radar.priceSensitivity,
      externalInfluenceScore: radar.externalInfluence,
      decisionStageScore: radar.decisionStage,
      tags,
      rawOutput: raw,
      promptVersion: PSY_PROMPT_VERSION,
      model: PSY_MODEL,
    })
    .onConflictDoUpdate({
      target: sessionPsychologySnapshots.sessionId,
      set: {
        acceptanceScore: radar.acceptance,
        motivationScore: radar.motivation,
        trustScore: radar.trust,
        priceSensitivityScore: radar.priceSensitivity,
        externalInfluenceScore: radar.externalInfluence,
        decisionStageScore: radar.decisionStage,
        tags,
        rawOutput: raw,
        promptVersion: PSY_PROMPT_VERSION,
        model: PSY_MODEL,
        createdAt: new Date(),
      },
    })
    .returning({ id: sessionPsychologySnapshots.id });

  return { ok: true, snapshotId: inserted[0].id, radar, tags };
}

function stripMarkdownFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
}
```

Note: `getAnthropic` est importé depuis `@/lib/claude` (qui existe déjà — vérifier la signature et adapter si besoin).

- [ ] **Step 3: Vérifier compilation**

Run:
```bash
pnpm typecheck
```

Expected: aucune erreur. Si import `getAnthropic` introuvable, vérifier `lib/claude.ts` pour la fonction réellement exportée et adapter.

- [ ] **Step 4: Commit**

```bash
git add lib/psychology/prompt.ts lib/psychology/score-session.ts
git commit -m "feat(psy): prompt template + fonction scorePatientPsychology

- Prompt versionné (psy-v1) avec définition explicite des 6 axes
- Sortie JSON strict parsé en PsyRadar + computeTags
- Persist via INSERT ON CONFLICT (rejouable sans doublons)
- Mode dryRun pour calibration"
```

---

### Task 5 : CLI de calibration `psy:score-session`

**Files:**
- Create: `scripts/psy-score-session.ts`
- Modify: `package.json` (ajouter le script npm)

- [ ] **Step 1: Créer `scripts/psy-score-session.ts`**

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import { scorePatientPsychology } from "../lib/psychology/score-session";

const sessionId = process.argv[2];

if (!sessionId) {
  console.error("Usage: pnpm psy:score-session <session_id> [--persist]");
  console.error("Par défaut, mode dry-run (n'écrit rien en DB).");
  process.exit(1);
}

const persist = process.argv.includes("--persist");

(async () => {
  const t0 = Date.now();
  console.log(`Scoring session ${sessionId} (${persist ? "persist" : "dry-run"})...`);

  try {
    const result = await scorePatientPsychology(sessionId, { dryRun: !persist });

    if ("skipped" in result) {
      console.log(`SKIPPED: ${result.skipped}`);
      process.exit(0);
    }

    console.log(`\n✓ Scoring OK (${Math.round((Date.now() - t0) / 1000)}s)`);
    console.log("\n--- Radar 6 axes ---");
    for (const [axis, score] of Object.entries(result.radar)) {
      const bar = score === null ? "(non observé)" : "█".repeat(score) + "░".repeat(10 - score);
      console.log(`  ${axis.padEnd(20)} ${score === null ? "  -" : String(score).padStart(3)} ${bar}`);
    }

    console.log(`\n--- Tags dérivés (${result.tags.length}) ---`);
    if (result.tags.length === 0) console.log("  (aucun)");
    else result.tags.forEach((t) => console.log(`  • ${t}`));

    console.log(`\n--- Snapshot ID ---`);
    console.log(`  ${result.snapshotId}`);

    if (!persist) {
      console.log(`\n[dry-run] Aucune écriture en DB. Ajouter --persist pour persister.`);
    }
  } catch (err) {
    console.error("\n✗ ERREUR:", err);
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Ajouter le script npm**

Ouvrir `package.json` et ajouter dans la section `scripts` (à proximité des autres `seed:*`) :

```json
"psy:score-session": "tsx --conditions react-server scripts/psy-score-session.ts",
```

- [ ] **Step 3: Identifier une session de test**

Run:
```bash
psql "$DATABASE_URL" -c "SELECT s.id, s.kind, p.label, s.duration_seconds FROM sessions s LEFT JOIN patients p ON p.id = s.patient_id WHERE s.analysis_status = 'done' AND s.patient_id IS NOT NULL LIMIT 5;"
```

Noter un session_id retourné (ex. de Mme Durand de préférence).

- [ ] **Step 4: Lancer le scoring en dry-run**

Run:
```bash
pnpm psy:score-session <session_id_noté>
```

Expected output (exemple):
```
Scoring session abc-123 (dry-run)...
✓ Scoring OK (12s)

--- Radar 6 axes ---
  acceptance              7 ███████░░░
  motivation              8 ████████░░
  trust                   8 ████████░░
  priceSensitivity        4 ████░░░░░░
  externalInfluence       3 ███░░░░░░░
  decisionStage           9 █████████░

--- Tags dérivés (3) ---
  • prospect-chaud
  • prêt-conversion
  • décisionnaire-éclairé
```

Si tous les axes sont `null` ou si un axe systématiquement absurde, AJUSTER le prompt dans `lib/psychology/prompt.ts` et relancer. C'est exactement la phase de calibration prévue avec Jonathan.

- [ ] **Step 5: Commit**

```bash
git add scripts/psy-score-session.ts package.json
git commit -m "feat(psy): CLI calibration pnpm psy:score-session

Mode dry-run par défaut (--persist pour écrire en DB).
Affiche radar ASCII + tags + rationale par axe.
Outil utilisé en pair Raphaël+Jonathan pour caler le prompt avant lock-in."
```

---

### Task 6 : Intégration dans le pipeline d'analyse

**Files:**
- Modify: `lib/analysis/analyze.ts` (au point post-success, vers la ligne 191)

- [ ] **Step 1: Ajouter l'appel psy au pipeline**

Localiser la fin du try (juste avant le `return { ok: true, ... }` à la ligne 191). Ajouter avant le return :

```typescript
    // Scoring psychologique du patient — best-effort, ne casse pas l'analyse coaching
    if (locked[0]) {
      try {
        const { scorePatientPsychology } = await import("@/lib/psychology/score-session");
        const psyResult = await scorePatientPsychology(sessionId);
        if ("ok" in psyResult) {
          log(sessionId, "psy-score", "ok", 0, {
            tags: psyResult.tags,
            radar: psyResult.radar,
          });
        } else {
          log(sessionId, "psy-score", `skipped:${psyResult.skipped}`, 0);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(sessionId, "psy-score", "failed", 0, { error: msg });
        // ne pas re-throw : l'analyse coaching a déjà réussi
      }
    }

    log(sessionId, "analyze", "ok", Date.now() - t0, {
```

(les 3 dernières lignes existent déjà — l'insertion se fait juste avant)

Note: l'import dynamique évite les cycles côté React Server Components et permet le code-splitting.

- [ ] **Step 2: Vérifier le typecheck**

Run:
```bash
pnpm typecheck
```

Expected: pas d'erreur.

- [ ] **Step 3: Test de bout en bout — relancer analyse d'une session existante**

Identifier une session, marquer `analysis_status = 'transcribed'` pour qu'elle soit re-analysable :

```bash
psql "$DATABASE_URL" -c "UPDATE sessions SET analysis_status = 'transcribed' WHERE id = '<session_id>';"
```

Puis déclencher l'analyse via l'UI (ou programmatiquement). À la fin, vérifier qu'un snapshot psy a été créé :

```bash
psql "$DATABASE_URL" -c "SELECT id, tags, model, created_at FROM session_psychology_snapshots WHERE session_id = '<session_id>';"
```

Expected: 1 ligne avec tags non vides et raw_output JSONB peuplé.

- [ ] **Step 4: Vérifier que l'analyse coaching a bien réussi indépendamment**

```bash
psql "$DATABASE_URL" -c "SELECT analysis_status, global_score, summary IS NOT NULL FROM sessions WHERE id = '<session_id>';"
```

Expected: `analysis_status = 'done'`, score et summary présents. Le scoring psy ne doit PAS empêcher la complétion de l'analyse principale.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/analyze.ts
git commit -m "feat(psy): intégration scoring psy dans le pipeline d'analyse

- Appel scorePatientPsychology après succès analyse coaching
- Try/catch isolé : une erreur psy ne casse pas l'analyse principale
- Logging dédié 'psy-score' pour traçabilité"
```

---

### Task 7 : Script de re-scoring batch des sessions seed

**Files:**
- Create: `scripts/psy-rescore-all.ts`
- Modify: `package.json`

- [ ] **Step 1: Créer le script batch**

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import { isNotNull, eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { sessions } from "../db/schema";
import { scorePatientPsychology } from "../lib/psychology/score-session";

(async () => {
  const onlyKind = process.argv[2] as "consultation" | "phone_call" | undefined;

  const conditions = [
    eq(sessions.analysisStatus, "done"),
    isNotNull(sessions.patientId),
  ];
  if (onlyKind) conditions.push(eq(sessions.kind, onlyKind));

  const all = await db
    .select({ id: sessions.id, kind: sessions.kind, label: sessions.summary })
    .from(sessions)
    .where(and(...conditions));

  console.log(`Re-scoring ${all.length} sessions${onlyKind ? ` (kind=${onlyKind})` : ""}...\n`);

  let ok = 0, skipped = 0, failed = 0;
  for (let i = 0; i < all.length; i++) {
    const s = all[i];
    process.stdout.write(`[${i + 1}/${all.length}] ${s.id.slice(0, 8)} ${s.kind}... `);
    try {
      const r = await scorePatientPsychology(s.id);
      if ("ok" in r) {
        console.log(`✓ tags=${r.tags.join(",") || "(none)"}`);
        ok++;
      } else {
        console.log(`skip:${r.skipped}`);
        skipped++;
      }
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nTotal: ${ok} ok, ${skipped} skipped, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
```

- [ ] **Step 2: Ajouter le script npm**

Dans `package.json`, ajouter à proximité de `psy:score-session` :

```json
"psy:rescore-all": "tsx --conditions react-server scripts/psy-rescore-all.ts",
```

- [ ] **Step 3: Smoke-test sur 1-2 sessions**

Lancer en limitant manuellement (commenter une condition ou utiliser un alias). Sinon, exécuter sur l'environnement seedé :

```bash
pnpm psy:rescore-all consultation
```

Expected: progression `[1/N]` ... `[N/N]`, résumé final. Coût Claude maîtrisé (45 sessions × ~3¢ ≈ $1.30).

- [ ] **Step 4: Commit**

```bash
git add scripts/psy-rescore-all.ts package.json
git commit -m "feat(psy): script batch pnpm psy:rescore-all [kind?]

Re-score toutes les sessions analysées avec patient_id non-null.
Filtre optionnel par kind (consultation | phone_call).
Idempotent grâce à INSERT ON CONFLICT du score-session."
```

---

## Phase 3 — UI page patient

### Task 8 : Composant `<PsychologyRadar>` (SVG multi-couches)

**Files:**
- Create: `components/patients/psychology-radar.tsx`

- [ ] **Step 1: Créer le composant SVG**

```typescript
"use client";

import { PSY_AXES, PSY_AXIS_LABEL, type PsyAxis, type PsyRadar } from "@/lib/psychology/axes";

type Layer = {
  key: string;
  radar: PsyRadar;
  color: string; // CSS color
  fillOpacity: number;
  strokeWidth: number;
  dasharray?: string;
  isGlobal?: boolean;
};

export type PsychologyRadarProps = {
  layers: Layer[];
  size?: number;
  className?: string;
};

const CX = 180;
const CY = 180;
const R = 140;

// Hexagon : 6 axes, rotation pour mettre acceptance en haut
const ANGLES: Record<PsyAxis, number> = {
  acceptance:        -Math.PI / 2,                  // top
  motivation:        -Math.PI / 2 + Math.PI / 3,
  trust:             -Math.PI / 2 + 2 * Math.PI / 3,
  decisionStage:     -Math.PI / 2 + Math.PI,        // bottom
  externalInfluence: -Math.PI / 2 + 4 * Math.PI / 3,
  priceSensitivity:  -Math.PI / 2 + 5 * Math.PI / 3,
};

function pointFor(axis: PsyAxis, value01: number): [number, number] {
  const a = ANGLES[axis];
  const r = R * value01;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function radarToPolygon(radar: PsyRadar): string {
  return PSY_AXES.map((axis) => {
    const v = radar[axis];
    const v01 = v === null ? 0 : v / 10;
    const [x, y] = pointFor(axis, v01);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function gridPolygon(scale: number): string {
  return PSY_AXES.map((axis) => {
    const [x, y] = pointFor(axis, scale);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function PsychologyRadar({ layers, size = 360, className }: PsychologyRadarProps) {
  return (
    <svg viewBox="0 0 360 360" width={size} height={size} className={className} role="img" aria-label="Profil psychologique patient">
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={gridPolygon(s)} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
      ))}
      {/* Axes */}
      {PSY_AXES.map((axis) => {
        const [x, y] = pointFor(axis, 1);
        return <line key={axis} x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(0,0,0,0.10)" strokeWidth={1} />;
      })}
      {/* Layers (older first, global last) */}
      {layers.map((layer) => (
        <polygon
          key={layer.key}
          points={radarToPolygon(layer.radar)}
          fill={layer.color}
          fillOpacity={layer.fillOpacity}
          stroke={layer.color}
          strokeWidth={layer.strokeWidth}
          strokeDasharray={layer.dasharray}
          strokeOpacity={1}
        />
      ))}
      {/* Labels */}
      {PSY_AXES.map((axis) => {
        const [x, y] = pointFor(axis, 1.15);
        const anchor =
          x < CX - 5 ? "end" :
          x > CX + 5 ? "start" :
          "middle";
        return (
          <text key={axis} x={x} y={y} fontSize="11" fill="#1A1A1A" fontWeight={500} textAnchor={anchor}>
            {PSY_AXIS_LABEL[axis]}
          </text>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Vérifier le rendu en isolation**

Créer un petit snippet test temporaire (à supprimer ensuite) — mettre dans une page existante (ex. `/admin`) pour vérifier visuellement :

```typescript
import { PsychologyRadar } from "@/components/patients/psychology-radar";

const mockGlobal = { acceptance: 7, motivation: 8, trust: 8, priceSensitivity: 4, externalInfluence: 3, decisionStage: 9 };
const mockOld = { acceptance: 4, motivation: 5, trust: 5, priceSensitivity: 6, externalInfluence: 4, decisionStage: 4 };

<PsychologyRadar layers={[
  { key: "old", radar: mockOld, color: "#9CA3AF", fillOpacity: 0.10, strokeWidth: 1.5, dasharray: "4 3" },
  { key: "global", radar: mockGlobal, color: "#CC0641", fillOpacity: 0.30, strokeWidth: 2.5 },
]} />
```

Lancer `pnpm dev` et vérifier dans le navigateur que le radar hexagonal est correct, axes labelisés, polygones distincts visibles.

- [ ] **Step 3: Retirer le snippet de test et commit**

```bash
git add components/patients/psychology-radar.tsx
git commit -m "feat(psy): composant SVG radar 6 axes multi-couches

Hexagon avec acceptance en haut, axes labelisés, support N layers
avec couleur/dasharray/opacité indépendants. Pas de dépendance externe."
```

---

### Task 9 : Card wrapper avec toggle, légende et tags

**Files:**
- Create: `components/patients/psychology-radar-card.tsx`

- [ ] **Step 1: Créer la card wrapper**

```typescript
"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PsychologyRadar } from "./psychology-radar";
import { PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";
import type { PsyRadar, PsySnapshot } from "@/lib/psychology/axes";

const SESSION_COLORS = [
  { color: "#9CA3AF", fillOpacity: 0.10, dasharray: "4 3" }, // oldest
  { color: "#E96A8E", fillOpacity: 0.10, dasharray: "4 3" },
  { color: "#CC0641", fillOpacity: 0.20, dasharray: "4 3" }, // most recent (before global)
];

const GLOBAL_LAYER = { color: "#CC0641", fillOpacity: 0.30, strokeWidth: 2.5 };

const KIND_LABEL: Record<string, string> = {
  consultation: "Consultation",
  phone_call: "Appel entrant",
};

export type PsychologyRadarCardProps = {
  globalRadar: PsyRadar;
  globalTags: PsyTag[];
  snapshots: Array<PsySnapshot & { sessionKind: "consultation" | "phone_call"; sessionStartedAt: Date }>;
};

export function PsychologyRadarCard({ globalRadar, globalTags, snapshots }: PsychologyRadarCardProps) {
  const [showHistory, setShowHistory] = useState(true);

  // last 3 sessions, oldest first (so they paint older→newer→global)
  const visibleSnapshots = snapshots.slice(0, 3).reverse();

  const layers = showHistory
    ? [
        ...visibleSnapshots.map((s, i) => ({
          key: s.id,
          radar: s.radar,
          ...SESSION_COLORS[Math.max(0, SESSION_COLORS.length - visibleSnapshots.length + i)],
          strokeWidth: 1.5,
        })),
        { key: "global", radar: globalRadar, ...GLOBAL_LAYER },
      ]
    : [{ key: "global", radar: globalRadar, ...GLOBAL_LAYER }];

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Profil psychologique
        </h3>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground transition hover:bg-border"
        >
          {showHistory ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showHistory ? "Masquer l'évolution" : "Afficher l'évolution"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_140px] lg:items-start">
        <div className="flex justify-center">
          <PsychologyRadar layers={layers} size={300} />
        </div>

        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="block h-2.5 w-5 rounded-sm border-2 border-brand bg-[rgba(204,6,65,0.3)]" />
            <span className="font-medium">Global synthétisé</span>
          </div>
          {showHistory &&
            visibleSnapshots.map((s, i) => {
              const idx = Math.max(0, SESSION_COLORS.length - visibleSnapshots.length + i);
              const cfg = SESSION_COLORS[idx];
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span
                    className="block h-2.5 w-5 rounded-sm border border-dashed"
                    style={{ borderColor: cfg.color, background: `${cfg.color}20` }}
                  />
                  <span className="text-foreground">
                    {KIND_LABEL[s.sessionKind]} ·{" "}
                    {s.sessionStartedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              );
            })}
          {snapshots.length > 3 && (
            <p className="mt-2 text-[11px] italic text-muted-foreground">
              {snapshots.length - 3} session(s) plus ancienne(s) non affichée(s)
            </p>
          )}
        </div>
      </div>

      {globalTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {globalTags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full border border-brand/20 bg-brand/8 px-2.5 py-1 text-[11px] font-medium text-brand"
            >
              {PSY_TAG_LABEL[t]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run:
```bash
pnpm typecheck
```

Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add components/patients/psychology-radar-card.tsx
git commit -m "feat(psy): card radar avec toggle évolution + légende + tags"
```

---

### Task 10 : Toggle de consentement marketing

**Files:**
- Create: `components/patients/marketing-consent-toggle.tsx`
- Create: `app/actions/psychology.ts`

- [ ] **Step 1: Créer la server action**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { grantMarketingConsent, revokeMarketingConsent } from "@/lib/psychology/consent";
import { getCurrentPractitionerId } from "@/lib/auth"; // adapter selon le helper existant

export async function grantConsentAction(patientId: string) {
  const actorId = await getCurrentPractitionerId();
  await grantMarketingConsent({ patientId, actorId, source: "patient_page" });
  revalidatePath(`/patients/${patientId}`);
}

export async function revokeConsentAction(patientId: string) {
  const actorId = await getCurrentPractitionerId();
  await revokeMarketingConsent({ patientId, actorId, source: "patient_page" });
  revalidatePath(`/patients/${patientId}`);
}
```

Note: `getCurrentPractitionerId` doit retourner `string | null`. Si la fonction n'existe pas avec ce nom dans `lib/auth.ts`, vérifier les helpers de `lib/role.ts` ou `lib/auth-shared.ts` et adapter — au pire, retourner `null` temporairement (l'audit log accepte actor_id null pour compatibilité avec le toggle de rôle factice du MVP).

- [ ] **Step 2: Créer le composant toggle**

```typescript
"use client";

import { useTransition } from "react";
import { Shield, ShieldOff } from "lucide-react";
import { grantConsentAction, revokeConsentAction } from "@/app/actions/psychology";

type Props = {
  patientId: string;
  consentAt: Date | null;
  revokedAt: Date | null;
};

function isActive(consentAt: Date | null, revokedAt: Date | null): boolean {
  if (!consentAt) return false;
  if (!revokedAt) return true;
  return consentAt.getTime() > revokedAt.getTime();
}

export function MarketingConsentToggle({ patientId, consentAt, revokedAt }: Props) {
  const [isPending, startTransition] = useTransition();
  const active = isActive(consentAt, revokedAt);

  const handleClick = () => {
    startTransition(async () => {
      if (active) await revokeConsentAction(patientId);
      else await grantConsentAction(patientId);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
        (active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-border bg-surface text-muted-foreground hover:bg-surface-muted")
      }
      title={
        active
          ? `Consentement marketing actif depuis le ${consentAt!.toLocaleDateString("fr-FR")}`
          : revokedAt
          ? `Consentement révoqué le ${revokedAt.toLocaleDateString("fr-FR")}`
          : "Consentement marketing non recueilli"
      }
    >
      {active ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
      Marketing analytique : {active ? "activé" : "désactivé"}
    </button>
  );
}
```

- [ ] **Step 3: Vérifier le typecheck**

Run:
```bash
pnpm typecheck
```

Expected: pas d'erreur. Si `getCurrentPractitionerId` n'existe pas, ajuster l'import et utiliser un placeholder commenté `// TODO: brancher sur l'auth réelle`.

- [ ] **Step 4: Commit**

```bash
git add app/actions/psychology.ts components/patients/marketing-consent-toggle.tsx
git commit -m "feat(psy): toggle consentement marketing + server actions

- grantConsentAction / revokeConsentAction avec audit log
- Composant client avec useTransition pour pending state
- Tooltip date de consentement / révocation"
```

---

### Task 11 : Intégrer radar + consent dans la page patient

**Files:**
- Modify: `app/patients/[id]/page.tsx`

- [ ] **Step 1: Ajouter les imports et le chargement des snapshots**

Au début de la fonction `PatientDetailPage`, après le chargement existant de `vaultPage` et `allPages`, ajouter le chargement des snapshots et la jointure session :

```typescript
import { PsychologyRadarCard } from "@/components/patients/psychology-radar-card";
import { MarketingConsentToggle } from "@/components/patients/marketing-consent-toggle";
import { getPatientSnapshots } from "@/lib/psychology/queries";
import { computeGlobalRadar, computeGlobalTags } from "@/lib/psychology/aggregate";
import { db } from "@/db/client";
import { sessions as sessionsTable } from "@/db/schema";
import { inArray } from "drizzle-orm";
```

Et dans le corps de la fonction, après la récupération de `vaultPage` :

```typescript
const psySnapshots = await getPatientSnapshots(patient.id);
const sessionMeta = psySnapshots.length === 0 ? [] : await db
  .select({ id: sessionsTable.id, kind: sessionsTable.kind, startedAt: sessionsTable.startedAt })
  .from(sessionsTable)
  .where(inArray(sessionsTable.id, psySnapshots.map((s) => s.sessionId)));

const sessionMetaById = new Map(sessionMeta.map((s) => [s.id, s]));

const enrichedSnapshots = psySnapshots
  .map((s) => {
    const meta = sessionMetaById.get(s.sessionId);
    return meta
      ? {
          ...s,
          sessionKind: meta.kind as "consultation" | "phone_call",
          sessionStartedAt: meta.startedAt ?? s.createdAt,
        }
      : null;
  })
  .filter((s): s is NonNullable<typeof s> => s !== null);

const globalRadar = computeGlobalRadar(psySnapshots);
const globalTags = computeGlobalTags(psySnapshots);
const hasAnyScore = Object.values(globalRadar).some((v) => v !== null);
```

- [ ] **Step 2: Ajouter le toggle consentement dans le header**

Dans le `<PageHeader actions={...}>`, à l'intérieur du `<div className="flex items-center gap-2">`, ajouter en première position (avant le badge de statut) :

```tsx
<MarketingConsentToggle
  patientId={patient.id}
  consentAt={patient.marketingPsyConsentAt}
  revokedAt={patient.marketingPsyRevokedAt}
/>
```

(Vérifier que `getPatientDetail` retourne bien ces 2 champs ; sinon adapter `lib/patients.ts` pour les inclure dans la projection.)

- [ ] **Step 3: Insérer la card radar dans l'aside**

Modifier le `<aside className="lg:col-span-5">` pour empiler la radar card au-dessus du bloc mémoire existant :

```tsx
<aside className="lg:col-span-5">
  <div className="sticky top-4 flex flex-col gap-6">
    {/* Bloc psychologie - nouveau */}
    {hasAnyScore && (
      <PsychologyRadarCard
        globalRadar={globalRadar}
        globalTags={globalTags}
        snapshots={enrichedSnapshots}
      />
    )}

    {/* Bloc mémoire - existant, déplacé dans le même container */}
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t("memoryHeader")}
        </h2>
        {/* ... reste du bloc mémoire inchangé ... */}
      </div>
      {/* ... */}
    </div>
  </div>
</aside>
```

- [ ] **Step 4: Vérifier le typecheck + le rendu**

Run:
```bash
pnpm typecheck
```

Lancer `pnpm dev` et naviguer vers `/patients/<id>` d'un patient ayant ≥ 1 session avec snapshot. Vérifier :
- Toggle consentement visible dans le header, cliquable
- Carte radar dans l'aside droit, au-dessus de la fiche mémoire
- Polygones multiples si plusieurs sessions, gradient chronologique
- Tags affichés sous le radar
- Toggle « Afficher / Masquer l'évolution » fonctionnel

Pour un patient SANS snapshot : la carte n'apparaît pas (condition `hasAnyScore`), la page reste lisible.

- [ ] **Step 5: Commit**

```bash
git add app/patients/[id]/page.tsx lib/patients.ts
git commit -m "feat(psy): intégration radar + toggle consent sur la page patient

- Carte radar dans l'aside, au-dessus de la fiche mémoire
- Toggle consentement marketing dans le header (badge avec date)
- Affichage conditionnel: rien si patient sans snapshot psy"
```

---

## Phase 4 — Page admin et export CSV

### Task 12 : Filtres + tableau admin

**Files:**
- Create: `lib/psychology/format-csv.ts`
- Create: `components/admin/psychology-filters.tsx`
- Create: `components/admin/psychology-table.tsx`
- Create: `app/admin/psychology/page.tsx`

- [ ] **Step 1: Créer le helper CSV**

```typescript
import type { PsyRadar } from "./axes";
import type { PsyTag } from "./tags";

export type PsyExportRow = {
  patientId: string;
  fullName: string;
  age: number | null;
  centerName: string | null;
  lastSessionDate: Date | null;
  tags: PsyTag[];
  globalRadar: PsyRadar;
  consentAt: Date | null;
};

const HEADER = [
  "patient_id","full_name","age","center_name","last_session_date",
  "tags","acceptance","motivation","trust","price_sensitivity",
  "external_influence","decision_stage","consent_at",
] as const;

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function formatPsychologyCsv(rows: PsyExportRow[]): string {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.patientId),
      csvCell(r.fullName),
      csvCell(r.age),
      csvCell(r.centerName),
      csvCell(isoDate(r.lastSessionDate)),
      csvCell(r.tags.join("|")),
      csvCell(r.globalRadar.acceptance),
      csvCell(r.globalRadar.motivation),
      csvCell(r.globalRadar.trust),
      csvCell(r.globalRadar.priceSensitivity),
      csvCell(r.globalRadar.externalInfluence),
      csvCell(r.globalRadar.decisionStage),
      csvCell(isoDate(r.consentAt)),
    ].join(","));
  }
  return lines.join("\n");
}
```

- [ ] **Step 2: Créer le composant de filtres**

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PSY_TAGS, PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";

export function PsychologyFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedTags = (params.get("tags")?.split(",").filter(Boolean) ?? []) as PsyTag[];
  const consentMode = params.get("consent") ?? "active";

  const update = (next: URLSearchParams) => {
    router.push(`/admin/psychology?${next.toString()}`);
  };

  const toggleTag = (tag: PsyTag) => {
    const next = new URLSearchParams(params);
    const set = new Set(selectedTags);
    set.has(tag) ? set.delete(tag) : set.add(tag);
    if (set.size > 0) next.set("tags", [...set].join(","));
    else next.delete("tags");
    update(next);
  };

  const setConsent = (mode: string) => {
    const next = new URLSearchParams(params);
    next.set("consent", mode);
    update(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {PSY_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition " +
                  (active
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface-muted text-foreground hover:border-brand/40")
                }
              >
                {PSY_TAG_LABEL[tag]}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Consentement marketing</p>
        <div className="flex gap-1.5">
          {[
            ["active", "Consentants uniquement"],
            ["all", "Tous (avec avertissement)"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setConsent(k)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition " +
                (consentMode === k ? "border-brand bg-brand text-white" : "border-border bg-surface-muted text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Créer le composant tableau**

```typescript
"use client";

import { useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";
import { PsychologyRadar } from "@/components/patients/psychology-radar";
import type { PsyExportRow } from "@/lib/psychology/format-csv";

type Props = {
  rows: PsyExportRow[];
  consentMode: "active" | "all";
};

export function PsychologyTable({ rows, consentMode }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(rows.map((r) => r.patientId)));
  const allSelected = selected.size === rows.length && rows.length > 0;

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.patientId)));

  const exportCsv = async () => {
    if (consentMode === "all") {
      const ok = window.confirm(
        "Vous incluez des patients non-consentants. Cet export ne peut PAS être utilisé en marketing direct (sanctions RGPD). Confirmer ?"
      );
      if (!ok) return;
    }
    const url = new URL("/admin/psychology/export", window.location.origin);
    url.searchParams.set("ids", [...selected].join(","));
    url.searchParams.set("consent", consentMode);
    window.location.href = url.toString();
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      {consentMode === "all" && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Mode <strong>« tous »</strong> activé. Les patients sans consentement marketing actif sont inclus. Vous ne pouvez pas utiliser ce fichier en campagne marketing.</span>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm">
          {selected.size} / {rows.length} sélectionné{selected.size > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exporter CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Tout sélectionner" /></th>
            <th className="px-4 py-2">Patient</th>
            <th className="px-4 py-2">Centre</th>
            <th className="px-4 py-2">Dernière session</th>
            <th className="px-4 py-2">Tags</th>
            <th className="px-4 py-2">Radar</th>
            <th className="px-4 py-2">Consent.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.patientId} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2"><input type="checkbox" checked={selected.has(r.patientId)} onChange={() => toggle(r.patientId)} /></td>
              <td className="px-4 py-2 font-medium">{r.fullName}</td>
              <td className="px-4 py-2 text-muted-foreground">{r.centerName ?? "—"}</td>
              <td className="px-4 py-2 text-muted-foreground">{r.lastSessionDate ? r.lastSessionDate.toLocaleDateString("fr-FR") : "—"}</td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">{PSY_TAG_LABEL[t as PsyTag]}</span>
                  ))}
                  {r.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{r.tags.length - 3}</span>}
                </div>
              </td>
              <td className="px-4 py-2">
                <PsychologyRadar
                  size={48}
                  layers={[{ key: "g", radar: r.globalRadar, color: "#CC0641", fillOpacity: 0.3, strokeWidth: 1.5 }]}
                />
              </td>
              <td className="px-4 py-2">
                {r.consentAt ? (
                  <span className="text-emerald-700">✓ {r.consentAt.toLocaleDateString("fr-FR")}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucun patient ne correspond aux filtres.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Créer la page admin**

```typescript
import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, sessions, sessionPsychologySnapshots, centers } from "@/db/schema";
import { PsychologyFilters } from "@/components/admin/psychology-filters";
import { PsychologyTable } from "@/components/admin/psychology-table";
import { PSY_TAGS, type PsyTag } from "@/lib/psychology/tags";
import { PageHeader } from "@/components/layout/page-header";
import { computeGlobalRadar, computeGlobalTags } from "@/lib/psychology/aggregate";
import { getPatientSnapshots } from "@/lib/psychology/queries";
import { hasActiveMarketingConsent } from "@/lib/psychology/consent";
import type { PsyExportRow } from "@/lib/psychology/format-csv";

export const dynamic = "force-dynamic";

export default async function AdminPsychologyPage({
  searchParams,
}: {
  searchParams: Promise<{ tags?: string; consent?: string }>;
}) {
  const params = await searchParams;
  const selectedTags = (params.tags?.split(",").filter(Boolean) ?? []) as PsyTag[];
  const consentMode = (params.consent === "all" ? "all" : "active") as "active" | "all";

  // Tous les patients qui ont au moins un snapshot psy
  const patientIds = await db
    .selectDistinct({ id: sessionPsychologySnapshots.patientId })
    .from(sessionPsychologySnapshots);

  const rows: PsyExportRow[] = [];
  for (const { id: pid } of patientIds) {
    const [pat] = await db.select().from(patients).where(eq(patients.id, pid)).limit(1);
    if (!pat) continue;
    if (consentMode === "active" && !hasActiveMarketingConsent(pat)) continue;

    const snapshots = await getPatientSnapshots(pid);
    const radar = computeGlobalRadar(snapshots);
    const tags = computeGlobalTags(snapshots);

    if (selectedTags.length > 0 && !selectedTags.some((t) => tags.includes(t))) continue;

    const center = pat.centerId
      ? (await db.select({ name: centers.name }).from(centers).where(eq(centers.id, pat.centerId)).limit(1))[0]
      : null;

    const lastSession = snapshots[0]?.createdAt ?? null;

    rows.push({
      patientId: pat.id,
      fullName: pat.label,
      age: pat.age,
      centerName: center?.name ?? null,
      lastSessionDate: lastSession,
      tags,
      globalRadar: radar,
      consentAt: pat.marketingPsyConsentAt,
    });
  }

  // tri par date de dernière session DESC
  rows.sort((a, b) => (b.lastSessionDate?.getTime() ?? 0) - (a.lastSessionDate?.getTime() ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profils psychologiques"
        description={`${rows.length} patient${rows.length > 1 ? "s" : ""} avec profil scoré · filtre actif : ${consentMode === "active" ? "consentants" : "tous"}`}
      />
      <PsychologyFilters />
      <PsychologyTable rows={rows} consentMode={consentMode} />
    </div>
  );
}
```

- [ ] **Step 5: Vérifier compilation + rendu**

Run:
```bash
pnpm typecheck
pnpm dev
```

Naviguer vers `/admin/psychology`. Vérifier que :
- Liste des patients avec snapshot s'affiche (filtrée sur consentants par défaut)
- Cliquer un tag dans les filtres recharge la page filtrée
- Switch « Tous » affiche le bandeau d'avertissement RGPD
- Mini-radars s'affichent en thumbnail dans le tableau

- [ ] **Step 6: Commit**

```bash
git add lib/psychology/format-csv.ts components/admin/ app/admin/psychology/page.tsx
git commit -m "feat(psy): page admin /admin/psychology avec filtres + tableau

- Filtres tags multi-select + mode consentement (actif / tous)
- Tableau avec checkbox, mini-radar, tags top-3
- Avertissement RGPD si mode 'tous' activé"
```

---

### Task 13 : Endpoint d'export CSV

**Files:**
- Create: `app/admin/psychology/export/route.ts`

- [ ] **Step 1: Créer l'endpoint GET**

```typescript
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { patients, centers, psychologyExportLog } from "@/db/schema";
import { getPatientSnapshots } from "@/lib/psychology/queries";
import { computeGlobalRadar, computeGlobalTags } from "@/lib/psychology/aggregate";
import { hasActiveMarketingConsent } from "@/lib/psychology/consent";
import { formatPsychologyCsv, type PsyExportRow } from "@/lib/psychology/format-csv";
import { getCurrentPractitionerId } from "@/lib/auth"; // adapter

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
  const consentMode = (params.get("consent") === "all" ? "all" : "active") as "active" | "all";

  if (ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  const rows: PsyExportRow[] = [];
  const pats = await db.select().from(patients).where(inArray(patients.id, ids));

  for (const pat of pats) {
    if (consentMode === "active" && !hasActiveMarketingConsent(pat)) continue;
    const snaps = await getPatientSnapshots(pat.id);
    if (snaps.length === 0) continue;
    const center = pat.centerId
      ? (await db.select({ name: centers.name }).from(centers).where(eq(centers.id, pat.centerId)).limit(1))[0]
      : null;
    rows.push({
      patientId: pat.id,
      fullName: pat.label,
      age: pat.age,
      centerName: center?.name ?? null,
      lastSessionDate: snaps[0]?.createdAt ?? null,
      tags: computeGlobalTags(snaps),
      globalRadar: computeGlobalRadar(snaps),
      consentAt: pat.marketingPsyConsentAt,
    });
  }

  // Audit log
  const actorId = await getCurrentPractitionerId();
  if (actorId) {
    await db.insert(psychologyExportLog).values({
      actorId,
      patientCount: rows.length,
      filters: { ids, consentMode },
      overrideNonConsenting: consentMode === "all",
    });
  }

  const csv = formatPsychologyCsv(rows);
  const filename = `psychology-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Test E2E manuel**

Run:
```bash
pnpm dev
```

Aller sur `/admin/psychology`, sélectionner 2-3 patients, cliquer « Exporter CSV ». Vérifier :
- Téléchargement du fichier `psychology-export-YYYY-MM-DD.csv`
- Contenu : header présent + 2-3 lignes avec les bonnes valeurs
- Audit log : ligne ajoutée dans `psychology_export_log` (`SELECT * FROM psychology_export_log ORDER BY created_at DESC LIMIT 5;`)

- [ ] **Step 3: Commit**

```bash
git add app/admin/psychology/export/route.ts
git commit -m "feat(psy): endpoint CSV export /admin/psychology/export

- GET ids=...&consent=active|all
- Filtre auto sur consentement (override si consent=all)
- Audit log dans psychology_export_log à chaque téléchargement"
```

---

## Phase 5 — Dashboard pro : section « Patients à recontacter »

### Task 14 : Composant + intégration dashboard

**Files:**
- Create: `components/dashboard/recall-list.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { Phone, ArrowRight } from "lucide-react";
import Link from "next/link";
import { searchPatientsByTags } from "@/lib/psychology/queries";
import { ACTIONABLE_TAGS, PSY_TAG_ACTIONS } from "@/lib/psychology/actions";
import { PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";

type RecallEntry = {
  patientId: string;
  patientLabel: string;
  centerName: string | null;
  topTag: PsyTag;
  topTags: PsyTag[];
  daysSince: number;
  action: { fr: string; en: string };
};

export async function RecallList({ centerId, locale = "fr" }: { centerId: string | null; locale?: "fr" | "en" }) {
  const candidates = await searchPatientsByTags({
    tags: [...ACTIONABLE_TAGS],
    requireConsent: true,
    centerId: centerId ?? undefined,
    daysSinceLastSession: 7,
  });

  const entries: RecallEntry[] = candidates.slice(0, 10).map((c) => {
    const sortedTags = (c.tags as PsyTag[])
      .filter((t) => t in PSY_TAG_ACTIONS)
      .sort((a, b) => PSY_TAG_ACTIONS[b].priority - PSY_TAG_ACTIONS[a].priority);
    const topTag = sortedTags[0] ?? "prospect-froid";
    const days = Math.floor((Date.now() - c.lastSessionAt.getTime()) / (24 * 3600 * 1000));
    return {
      patientId: c.patientId,
      patientLabel: c.patientLabel,
      centerName: null, // TODO: jointure centre si nécessaire (peut-être pas utile dans ce contexte)
      topTag,
      topTags: sortedTags.slice(0, 2),
      daysSince: days,
      action: PSY_TAG_ACTIONS[topTag],
    };
  });

  if (entries.length === 0) return null;

  const visible = entries.slice(0, 5);

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Patients à recontacter ({entries.length})
          </h2>
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {visible.map((e) => (
          <li key={e.patientId}>
            <Link
              href={`/patients/${e.patientId}`}
              className="group flex items-center justify-between rounded-md px-3 py-2 transition hover:bg-surface-muted"
            >
              <div>
                <p className="text-sm font-medium">{e.patientLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {e.topTags.map((t) => PSY_TAG_LABEL[t]).join(" · ")} ·{" "}
                  <span className="italic">il y a {e.daysSince}j</span>
                </p>
                <p className="mt-1 text-xs text-brand">→ {locale === "en" ? e.action.en : e.action.fr}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>
          </li>
        ))}
      </ul>
      {entries.length > 5 && (
        <Link href="/admin/psychology" className="mt-3 block text-center text-xs text-brand hover:underline">
          Voir tous ({entries.length})
        </Link>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Intégrer dans le dashboard**

Lire `app/page.tsx` pour identifier la structure actuelle. Ajouter `<RecallList>` dans la zone appropriée (entre la heatmap et la table « dernières consultations » selon la spec). L'import :

```typescript
import { RecallList } from "@/components/dashboard/recall-list";
```

Position recommandée : `<RecallList centerId={...} locale={locale} />` dans la grille du dashboard, en pleine largeur ou en col span adapté. Le `centerId` vient des données de session de l'utilisateur courant ; si l'auth n'est pas encore branchée pour cela, passer `null` pour tester.

- [ ] **Step 3: Vérifier le rendu**

Run:
```bash
pnpm typecheck
pnpm dev
```

Sur le dashboard, vérifier :
- La section apparaît si au moins un patient consentant a un tag actionnable et pas de session depuis 7+ jours
- Click sur un item navigue vers `/patients/<id>`
- Si aucun candidat, la section ne s'affiche pas (return null)

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/recall-list.tsx app/page.tsx
git commit -m "feat(psy): section 'Patients à recontacter' sur le dashboard

- Liste filtrée: tags actionnables + consentement actif + ≥ 7j sans session
- Action suggérée par tag (top priority)
- Lien vers fiche patient + lien 'Voir tous' vers /admin/psychology"
```

---

## Phase 6 — Seed de démo

### Task 15 : Régénérer les snapshots seed

**Files:** (aucun nouveau fichier — utilise les scripts existants)

- [ ] **Step 1: Marquer ~70% des patients seed avec consentement actif**

Script SQL one-shot :

```sql
UPDATE patients
SET marketing_psy_consent_at = NOW() - (random() * interval '90 days')
WHERE marketing_psy_consent_at IS NULL
  AND id IN (
    SELECT id FROM patients ORDER BY random() LIMIT (SELECT count(*) * 0.7 FROM patients)::int
  );
```

Run:
```bash
psql "$DATABASE_URL" -f /tmp/consent-seed.sql
```

(Créer le fichier `/tmp/consent-seed.sql` avec le SQL ci-dessus, ou le passer en `-c "..."`.)

- [ ] **Step 2: Lancer le re-scoring batch**

Run:
```bash
pnpm psy:rescore-all
```

Expected: progression `[1/N] ... [N/N]`, résumé final `X ok, Y skipped, Z failed`. Coût estimé < $2.

- [ ] **Step 3: Vérifier la qualité d'au moins 3 snapshots clés**

Run:
```bash
psql "$DATABASE_URL" -c "SELECT p.label, sps.tags FROM session_psychology_snapshots sps JOIN patients p ON p.id=sps.patient_id ORDER BY sps.created_at DESC LIMIT 10;"
```

Pour les patients clés de démo (Mme Durand, M. Martin, Mme Lefèvre), ouvrir leurs pages `/patients/<id>` et vérifier visuellement :
- Mme Durand : trajectoire qui s'améliore, tags `prospect-chaud` ou `prêt-conversion` sur la dernière session
- M. Martin : présence de `réfractaire-prix` (consult initiale)
- Mme Lefèvre : `méfiant` ou `réfractaire-prix`

Si un patient clé n'a pas le profil attendu, c'est un signal pour ajuster le prompt et relancer ce patient spécifiquement :
```bash
psql "$DATABASE_URL" -c "SELECT id FROM sessions WHERE patient_id=(SELECT id FROM patients WHERE label LIKE '%Durand%') ORDER BY started_at;"
# puis pour chaque session_id :
pnpm psy:score-session <session_id> --persist
```

- [ ] **Step 4: Vérifier la section dashboard**

Sur le dashboard, vérifier que la section « Patients à recontacter » liste M. Martin et/ou Mme Lefèvre (selon centerId chargé).

- [ ] **Step 5: Commit (le commit ne contient que d'éventuels ajustements de prompt)**

Si le prompt a été ajusté pendant la calibration :

```bash
git add lib/psychology/prompt.ts
git commit -m "feat(psy): calibration prompt psy-v1 sur seed démo

Ajustements après dry-run sur 5-10 sessions seed avec Jonathan."
```

Si rien à committer (les snapshots vivent en DB seulement), passer cette étape.

---

## Self-Review

**1. Couverture du spec :**

| Spec section | Couvert par |
|---|---|
| §3 — 6 axes hybrides | Task 2 (`lib/psychology/axes.ts`) |
| §4.1 — Pipeline scoring parallèle | Task 6 (intégration `analyze.ts`) |
| §4.2 — 4 surfaces UI | Tasks 11, 12, 13, 14 |
| §5.1 — Table snapshots | Task 1 |
| §5.2 — Colonnes consent patient | Task 1 |
| §5.3 — Tables audit RGPD | Task 1 |
| §5.4 — Drizzle types | Task 1 (génération auto) |
| §6.1 — Prompt Claude | Task 4 |
| §6.2 — 10 tags rules-based | Task 2 |
| §6.3 — Aggregation globale | Task 3 |
| §7.1 — Layout patient page | Task 11 |
| §7.2 — Page admin + CSV | Tasks 12, 13 |
| §7.3 — Dashboard recall list | Task 14 |
| §8 — Consentement RGPD 2 niveaux | Tasks 3 (helpers), 10 (UI), 13 (export filter) |
| §9 — CLI calibration | Task 5 |
| §10 — Seed démo | Task 15 |

**2. Placeholder scan :** Quelques `// adapter selon...` dans les imports auth, signalés explicitement et avec instruction de fallback (`null`). Pas de TBD réel.

**3. Type consistency :** `PsyRadar`, `PsySnapshot`, `PsyTag`, `PsyAxis` définis Task 2 et utilisés cohéremment partout. Colonnes DB en snake_case mappées en camelCase via Drizzle.

---

## Execution Handoff

Plan complet et sauvegardé dans `docs/superpowers/plans/2026-05-08-patient-psychology.md`. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — Je dispatch un subagent frais par tâche, je review entre chaque, itération rapide. Adapté à ce plan parce que les tâches sont indépendantes par phase, et le contexte de chaque subagent reste propre.

**2. Inline Execution** — J'exécute les tâches dans cette session avec checkpoints. Plus simple si tu veux suivre en direct sans dispatch, mais ce contexte est déjà bien rempli (brainstorming + spec) — risque de saturation.

Lequel ?
