# Enrichissement des exports patients — Design

**Date** : 2026-05-09
**Auteur** : Raphaël Zakine + Claude
**Statut** : Validé pour implémentation

---

## 1. Pourquoi

L'export patients existe (depuis le merge `d271d33` "exports marketing") mais n'expose qu'une fraction de la donnée disponible : **6 axes psy + tags + identité minimale**. Pour la démo Amplifon, on veut un export **exhaustif et plug-and-play** dans n'importe quelle stack marketing du client : CRM, Excel, API. L'argument commercial à faire passer : *Clinic OS s'intègre partout, et chaque ligne d'export contient déjà une recommandation marketing prête à exécuter*.

L'enrichissement vise deux dimensions :
- **Contenu** — ajouter statut funnel, engagement, opportunité commerciale (€), détail psy par axe, et une recommandation marketing IA.
- **Formats** — ajouter XLSX (multi-feuilles) et JSON (intégration), le CSV restant le format pivot.

Le PDF a été explicitement écarté : il n'intègre rien, dilue le pitch, et le cas d'usage interne est déjà couvert par la fiche digitale dans Clinic OS.

---

## 2. Décisions tranchées

| Décision | Choix | Justification |
|---|---|---|
| Cas d'usage cible | Exhaustif — l'export sert à la fois CRM, équipe marketing humaine, dev/IT | Le client filtrera selon ses besoins ; on optimise pour la démo |
| Formats | **CSV / XLSX / JSON** | Couvrent les 3 cibles d'intégration ; PDF dropé |
| Granularité | 1 ligne = 1 patient (vue agrégée), XLSX a 4 feuilles séparées | Compromis lisibilité ↔ exhaustivité |
| Portées UI | Bulk (depuis `/patients`) **+** Single (depuis fiche patient) | Cohérent avec les 2 points d'entrée existants |
| Composant choix format | Dropdown propre (clic = ouvre menu) | Plus visible en démo |
| Stratégie route | Route unifiée `/api/exports/patients?format=…` | DRY, pipeline interne unique |
| Lib XLSX | `exceljs` | Multi-feuilles + styling natif |
| Section 7 (recommandation IA) | Inclus, **1 appel Haiku par patient en parallèle** | Plus robuste qu'un batch unique, coût négligeable en démo |
| Section 7 — failure mode | **Fallback silencieux** (champs `null`, log warning) | L'export ne plante jamais |
| `urgency_score` | **Mixte 70/30** : formule déterministe sur radar + tags + funnel + ajustement LLM ±15 | Reproductible et documentable, nuançable par l'IA |
| `top_insights` | **Max 3** par patient, triés par `estimated_impact_eur` desc | Lisible en CSV, suffisant en démo |
| i18n | Noms de champs en EN snake_case, valeurs textuelles localisées (FR/EN) | Standard d'intégration tech ; sélecteur langue dans le dropdown |

---

## 3. Architecture UI

### Bulk export — depuis `/patients`

Le bouton actuel "Exporter CSV" devient un **dropdown** :

```
[ Exporter ▾ ] (N)
   ├─ CSV
   ├─ XLSX
   └─ JSON
   ─────
   Langue : ◉ FR  ◯ EN
```

Le bouton est désactivé si aucun patient sélectionné/filtré n'a de consentement actif.

### Single export — depuis la fiche patient

Le bouton existant dans `marketing-consent-toggle.tsx` (et là où il est exposé) devient le **même dropdown**. Mêmes 3 formats. Pas de PDF.

### Composant partagé

Un seul composant `<ExportFormatMenu>` consommé aux deux endroits :

```typescript
type Props = {
  exportableCount: number;
  buildUrl: (format: "csv" | "xlsx" | "json", locale: "fr" | "en") => string;
  defaultLocale: "fr" | "en";          // suit l'UI
  disabled?: boolean;
  disabledTooltip?: string;
};
```

Le composant déclenche la navigation/téléchargement (pas de fetch JS — un `<a href download>` propre par format). Pas besoin d'état serveur côté client : le téléchargement vient directement de l'API.

---

## 4. Architecture backend

### Route unifiée

```
GET /api/exports/patients?ids=…&consent=active|all&format=csv|xlsx|json&locale=fr|en
```

**Migration** : la route existante `/admin/psychology/export` reste fonctionnelle dans la même PR mais devient un **307 redirect** vers `/api/exports/patients?format=csv` (préserve les liens internes, à supprimer dans une PR ultérieure si on veut).

### Pipeline interne

```
┌─────────────────────────────────────────────────────┐
│ Route /api/exports/patients                         │
│   1. Parse params (ids, consent, format, locale)    │
│   2. buildPatientExportData(ids, consent, locale)   │
│      → PatientExportRecord[]                        │
│   3. Switch format → formatter dédié                │
│   4. Renvoie le binaire/texte avec headers HTTP     │
└─────────────────────────────────────────────────────┘
```

### Structure de fichiers

```
lib/psychology/export/
├── build.ts              # buildPatientExportData() — source unique
├── recommendation.ts     # Section 7 — appel Haiku par patient + fallback
├── urgency.ts            # Calcul déterministe du score (formule documentée)
├── format-csv.ts         # déjà là — déplacé + enrichi (1 ligne / patient)
├── format-xlsx.ts        # nouveau — 4 feuilles via exceljs
└── format-json.ts        # nouveau — JSON.stringify de l'arbre

app/api/exports/patients/route.ts   # nouvelle route, dispatch
app/admin/psychology/export/route.ts # alias 307 (à terme: supprimable)
components/exports/export-format-menu.tsx  # composant dropdown réutilisable
```

### Choix de libs

- **`exceljs`** — multi-feuilles + styling natif (couleurs charte, headers gras, freeze panes). MIT, ~2 MB. Choisi vs `xlsx` (sheetjs) qui est minimaliste.
- **Pas de lib JSON** — `JSON.stringify` natif suffit.
- **CSV** — implémentation maison existante (`csvCell`, `isoDate`), juste enrichie.

---

## 5. Schema de données — `PatientExportRecord`

Source de vérité produite par `buildPatientExportData()`. Tous les formats dérivent de là.

```typescript
type PatientExportRecord = {
  // 1. Identité
  patient_id: string;
  full_name: string;
  age: number | null;
  center_name: string | null;
  marketing_consent_at: string | null;     // ISO date

  // 2. Statut funnel (calculé)
  status: "prospect" | "patient" | "lost";
  current_stage: PatientEventKind | null;  // dernière étape franchie
  first_contact_at: string | null;          // ISO
  last_interaction_at: string | null;       // ISO
  days_in_pipeline: number | null;
  days_in_current_stage: number | null;

  // 3. Engagement
  total_sessions: number;
  consultations_count: number;
  phone_calls_count: number;
  total_duration_minutes: number;
  avg_session_score: number | null;         // 0-100
  last_session_score: number | null;

  // 4. Profil psy global
  tags: PsyTag[];                            // codes (i18n côté label séparé)
  tags_label: string[];                      // localisés FR/EN
  radar: PsyRadar;                           // {acceptance, motivation, …}

  // 5. Profil psy enrichi (par axe)
  radar_detail: Record<PsyAxis, {
    score: number | null;
    rationale: string | null;                // résumé IA depuis snapshot source (localisé)
    verbatim: string | null;                 // citation patient
    trend: "up" | "down" | "stable" | null;
    source_session_id: string | null;
  }>;

  // 6. Opportunité commerciale
  opportunity: {
    total_estimated_eur: number;             // sum sur toutes sessions
    missed_objections_count: number;
    upsell_missed_count: number;
    top_insights: Array<{                    // max 3, triés par impact desc
      title: string;                         // localisé
      estimated_impact_eur: number | null;
      severity: "info" | "warning" | "critical";
      session_date: string;
    }>;
  };

  // 7. Recommandation marketing (IA)
  recommendation: {
    priority_segment: "hot" | "warm" | "cold" | "lost";
    urgency_score: number;                   // 0-100
    recommended_channel: "phone" | "email" | "sms" | "in_person" | "no_touch";
    recommended_angle: string;               // libre, localisé
    next_best_action: string;                // 1 phrase actionnable, localisée
  } | null;                                   // null si Haiku échoue
};
```

### Dérivations / calculs

- **`current_stage`** = `kind` du `patient_event` le plus récent du patient
- **`days_in_pipeline`** = `now - first_contact_at`
- **`days_in_current_stage`** = `now - occurredAt(current_stage)`
- **`tags`** = `computeGlobalTags(snapshots)` (existe)
- **`radar_detail[axis].trend`** = comparaison de la valeur la plus récente vs la précédente (parmi snapshots où l'axe est non-null) ; `stable` si écart < 1 ; `null` si moins de 2 snapshots avec valeur sur cet axe
- **`top_insights`** = `coachingInsights` joints sur `sessions.patient_id`, triés par `estimated_impact_eur DESC NULLS LAST`, top 3
- **`recommendation.urgency_score`** = `clamp(0, 100, base + urgency_boost)` (cf. §7)

---

## 6. i18n — stratégie

| Élément | Localisé ? |
|---|---|
| Noms de champs JSON, headers CSV/XLSX | **Non** — anglais snake_case fixe |
| Codes (`tags`, `priority_segment`, `recommended_channel`, `current_stage`, `severity`) | **Non** — codes stables |
| `tags_label` | **Oui** — utilise `PSY_TAG_LABEL_EN` (existe) |
| `radar_detail[axis].rationale`, `verbatim` | **Oui** — extrait depuis le snapshot, déjà localisé en base (psy supporte EN) |
| `top_insights[].title` | **Oui** — il faut vérifier que les insights sont stockés dans une langue prévisible. Pour la démo : on suppose que le titre est généré en FR, on **traduit à la volée par Haiku** pour l'EN si la locale demandée diffère (1 appel batché par export EN, optionnel). Si trop coûteux, fallback : passer le titre tel quel. |
| `recommendation.recommended_angle`, `next_best_action` | **Oui** — le prompt Haiku reçoit la `locale` |

**Sélecteur langue dans le dropdown** : default = locale UI, override possible par radio FR/EN.

---

## 7. Section 7 — Recommandation marketing IA

### Calcul `urgency_score` (mixte 70/30)

**Composante déterministe `base` (0–85)** — fonction documentée :

```typescript
function computeUrgencyBase(record: PatientExportRecord): number {
  let s = 0;
  const r = record.radar;
  // Avancement décision
  if (r.decision_stage !== null && r.decision_stage >= 7) s += 30;
  else if (r.decision_stage !== null && r.decision_stage >= 5) s += 15;
  // Motivation
  if (r.motivation !== null && r.motivation >= 7) s += 20;
  else if (r.motivation !== null && r.motivation >= 5) s += 10;
  // Confiance basse → urgence (à rassurer vite)
  if (r.trust !== null && r.trust <= 4) s += 10;
  // Pipeline qui traîne (prospect)
  if (record.status === "prospect" &&
      record.days_in_pipeline !== null && record.days_in_pipeline > 30) s += 15;
  // Patient déjà perdu → 0
  if (record.status === "lost") return 0;
  // Bonus tag "prospect-chaud"
  if (record.tags.includes("prospect-chaud")) s += 10;
  return Math.min(85, s);
}
```

**Composante LLM `urgency_boost`** : entier entre `-15` et `+15`, retourné par Haiku selon nuance contextuelle. Score final = `clamp(0, 100, base + boost)`.

### Prompt Haiku (par patient, 1 appel chacun en parallèle)

**Modèle** : `claude-haiku-4-5-20251001`
**Output** : JSON strict via `tool_use` avec schema (force le format)

**Input** :
- Profil psy (radar global + tags)
- Statut funnel (status, étape, jours)
- `top_insights` (titre + montant)
- Score moyen sessions
- `locale` ciblée

**Output forcé** :
```json
{
  "priority_segment": "hot|warm|cold|lost",
  "urgency_boost": <int -15..15>,
  "recommended_channel": "phone|email|sms|in_person|no_touch",
  "recommended_angle": "<string court, localisé>",
  "next_best_action": "<string 1 phrase, actionnable, localisée>"
}
```

### Batching

**1 appel par patient en parallèle** via `Promise.all` (limite via `p-limit` à 8 concurrents pour éviter rate-limit Anthropic). Sur 30 patients démo : ~3-5 s, ~$0.03.

### Failure mode

Si l'appel Haiku échoue (timeout, JSON invalide, rate limit) :
- `recommendation = null` pour ce patient
- Log `console.warn` côté serveur
- L'export sort sans la section 7 pour ce patient ; les autres patients ne sont pas impactés

### Cache

**Aucun cache cross-requête** pour la démo. Cache trivial in-memory dans `buildPatientExportData()` pour ne pas appeler Haiku 2× si le même patient apparaît plusieurs fois (hypothétique). En prod : nightly cron qui pré-calcule + colonne `patients.recommendation_cached_at` + invalidation à chaque nouvelle session.

---

## 8. Formats — détail de la sérialisation

### CSV

1 ligne = 1 patient. **Flatten** des structures imbriquées avec préfixes :

```
patient_id,full_name,age,center_name,marketing_consent_at,
status,current_stage,first_contact_at,last_interaction_at,days_in_pipeline,days_in_current_stage,
total_sessions,consultations_count,phone_calls_count,total_duration_minutes,avg_session_score,last_session_score,
tags,tags_label,
psy_acceptance_score,psy_motivation_score,psy_trust_score,psy_price_sensitivity_score,psy_external_influence_score,psy_decision_stage_score,
psy_acceptance_rationale,psy_acceptance_verbatim,psy_acceptance_trend,
… (idem pour les 5 autres axes) …
opportunity_total_eur,opportunity_missed_objections,opportunity_upsell_missed,
top_insight_1_title,top_insight_1_eur,top_insight_1_severity,top_insight_1_date,
top_insight_2_title,top_insight_2_eur,top_insight_2_severity,top_insight_2_date,
top_insight_3_title,top_insight_3_eur,top_insight_3_severity,top_insight_3_date,
reco_priority_segment,reco_urgency_score,reco_channel,reco_angle,reco_next_best_action
```

~50 colonnes. Tableaux (`tags`, `tags_label`) sérialisés avec `|` séparateur. `null` → cellule vide.

### XLSX (4 feuilles)

| Feuille | Granularité | Contenu |
|---|---|---|
| **Patients** | 1 ligne / patient | Vue agrégée, mêmes colonnes que le CSV |
| **Sessions** | 1 ligne / session | session_id, patient_id, kind, started_at, duration, global_score, summary |
| **Insights** | 1 ligne / coaching_insight | insight_id, patient_id, session_id, type, severity, title, description, estimated_impact_eur |
| **Timeline** | 1 ligne / patient_event | event_id, patient_id, kind, occurred_at, summary |

**Styling** :
- Headers : fond `#CC0641`, texte blanc, gras
- Freeze pane sur la première ligne et la première colonne
- Formats numériques (€ pour `_eur`, % pour scores)
- Onglets nommés en français/anglais selon locale

### JSON

```json
{
  "exported_at": "2026-05-09T14:32:11Z",
  "locale": "fr",
  "consent_mode": "active",
  "count": 30,
  "patients": [
    {
      "patient_id": "...",
      "full_name": "...",
      // ... toute la structure PatientExportRecord ...
    }
  ]
}
```

Indenté 2 espaces (lisible mais raisonnable).

---

## 9. Tests

| Type | Cible | Cas couverts |
|---|---|---|
| Unit | `buildPatientExportData` | Snapshot JSON sur Mme Durand seedée — figé. Toute regression de schema casse. |
| Unit | `format-csv` | Output déterministe sur input fixe ; échappement quotes/virgules ; null → vide |
| Unit | `format-xlsx` | Vérifie présence des 4 feuilles, headers, 1 ligne échantillon par feuille |
| Unit | `format-json` | Structure conforme au type, dates ISO, indentation |
| Unit | `urgency.ts` | Cas limites (status=lost → 0, tous axes null → 0, prospect-chaud +10, etc.) |
| Unit | `recommendation.ts` (Anthropic mocké) | Output valide → renvoyé tel quel ; output invalide JSON → `null` ; timeout → `null` |
| E2E (Playwright) | `/patients` | Sélection 3 patients → dropdown → CSV → fichier téléchargé non vide. Idem XLSX et JSON. |

**Pas de test sur le rendu visuel XLSX** (couleurs, freeze) — effort >> valeur en démo.

---

## 10. Migration

- `lib/psychology/format-csv.ts` → **déplacé** vers `lib/psychology/export/format-csv.ts` et **enrichi** des nouvelles colonnes. Le format CSV existant casse — accepté car aucun consommateur externe.
- Route `/admin/psychology/export` → reste, mais devient **307 redirect** vers `/api/exports/patients?format=csv&consent=…&ids=…`. Préserve les liens existants pendant la PR. Suppression possible dans une PR ultérieure.
- `marketing-consent-toggle.tsx` et `patients-table.tsx` → migrent vers le nouveau composant `<ExportFormatMenu>`.

---

## 11. Storytelling démo

Sur ~3 minutes, à insérer dans le pilier 1 ou pilier 2 (selon timing) :

1. Jonathan filtre `/patients` sur tag "prospect-chaud" → 5 patients
2. Clic dropdown **"Exporter ▾"** → liste claire CSV / XLSX / JSON + sélecteur langue
3. **CSV** → "Format universel pour HubSpot, Salesforce, votre CRM"
4. **XLSX** → ouvre devant Amplifon, **4 feuilles colorées**, "vos analystes l'ouvrent direct, ils filtrent, ils trient"
5. **JSON** → ouvre dans VSCode/terminal, "vos devs branchent ça à n'importe quoi en 5 lignes — Zapier, n8n, votre stack interne"
6. Punchline : "**et chaque ligne contient déjà une recommandation marketing prête à exécuter**" — montre la colonne `reco_next_best_action` sur Mme Lefèvre

**Champ wow non négociable** : la phrase `next_best_action` doit être **belle** sur les 3 patients démo (Durand/Martin/Lefèvre). Pré-vérifier manuellement sur le seed et ajuster le prompt si la sortie est plate.

---

## 12. Hors scope

- **PDF** — drop, pas d'argument d'intégration ; le cas d'usage interne est couvert par la fiche digitale Clinic OS et les artefacts existants (notes cliniques, courrier ORL).
- **Audience segments séparés** (style "prospects-chauds.csv" pour Meta/Google Ads custom audiences) — nice-to-have, pas pour cette itération.
- **Webhook / push** vers un CRM cible — démontré "by hand" en démo, pas d'intégration vivante.
- **Cache cross-requête de la recommandation IA** — démo en live ; en prod nightly cron à concevoir séparément.
- **Audit log de l'export** — la TODO existante dans `route.ts` (actor_id) reste ouverte tant que pas d'auth réelle.
- **Anonymisation** — pas pour l'export marketing (qui suppose le consentement) ; un mode anonymisé pour reporting/compliance serait un autre chantier.

---

## 13. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Haiku timeout sur 30+ patients en parallèle | `p-limit` à 8 concurrents ; fallback silencieux par patient |
| Sortie LLM "plate" sur la démo | Pré-vérification manuelle sur les 3 patients démo + itération prompt |
| Schema XLSX trop chargé visuellement | Itération en J9 sur les 3 patients démo ; styling minimal mais cohérent |
| Régression sur l'export CSV existant | Snapshot test sur un patient seedé qui figerait toute évolution non voulue |
| Coût Haiku en démo (30 patients × N exports) | Cache in-memory dans la requête + limit concurrence ; coût estimé < $0.10 pour la durée totale de la démo |
