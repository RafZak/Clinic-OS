# Profil psychologique patient — Spec design

**Date** : 2026-05-08
**Auteur** : Raphaël Zakine + Claude (brainstorming session)
**Statut** : design validé, prêt pour writing-plans

---

## 1. Contexte

Suite à une première démo concluante, un signal d'achat important : les interlocuteurs souhaitent voir **un profil psychologique du patient** qui irait au-delà du coaching praticien existant. Le besoin couvre deux usages :

1. **Aider le pro à adapter sa posture** en visualisant la disposition psychologique du patient (acceptant, réfractaire, anxieux, en exploration, etc.).
2. **Permettre des exports marketing ciblés** : tagger les patients selon leur profil pour alimenter différents funnels (relance financement, nurturing, conversion, etc.).

Cette feature s'inscrit dans la philosophie produit existante du PRD :
- **Ambiance > friction** — scoring auto à partir des transcripts déjà capturés, aucune saisie manuelle au runtime.
- **Compound > snapshot** — chaque session enrichit la mémoire du patient.
- **Parcours > événement** — le profil global synthétise toutes les interactions, pas juste la dernière.

## 2. Décisions cadres validées

| Décision | Choix retenu |
|---|---|
| Cadrage | **Vraie feature livrable**, pas teaser roadmap |
| Granularité temporelle | **Score par session + global synthétisé** (trajectoire conservée) |
| Auteur du score | **IA auto au runtime**, calibration manuelle Jonathan + Raphaël en amont |
| Axes du radar | **6 axes hybrides** (commercial + émotionnel) |
| Consommateurs | **MVP : centre + pro** (CSV filtré + liste actionnable). API HQ en roadmap. |
| Consentement RGPD | **Opt-in explicite à 2 niveaux** (clinique obligatoire / marketing optionnel) |
| Sessions scorées | **Consultations + appels entrants** |
| Aggregation globale | **« Plus récent observé par axe »** — déterministe, explicable |
| Layout page patient | **Radar dans l'aside droit, au-dessus de la fiche mémoire** |
| Multi-session radar | **Superposition de polygones avec gradient chronologique** + toggle |

## 3. Les 6 axes du radar

Échelle 0-10 par axe, `null` si non observable depuis le transcript de la session.

| Axe | Description |
|---|---|
| Acceptation déficit | Reconnaissance et acceptation du problème auditif (0 = déni, 10 = pleinement accepté) |
| Motivation | Énergie d'engagement dans le traitement (0 = passif/résigné, 10 = moteur) |
| Confiance pro | Niveau de confiance accordé à l'audioprothésiste (0 = méfiance ouverte, 10 = confiance totale) |
| Sensibilité prix | Importance du frein financier dans la décision (0 = peu sensible, 10 = très sensible) |
| Influence entourage | Rôle décisionnel de l'entourage (0 = autonome, 10 = entourage déterminant) |
| Stade décisionnel | Avancement dans le parcours de décision (0 = exploration, 10 = prêt à signer) |

> **À valider par Jonathan** : libellés exacts et exemples comportementaux observables par axe. Cette validation se fait pendant la phase calibration (cf. § 9).

## 4. Architecture

### 4.1 Pipeline de scoring

Le pipeline d'analyse de session existant (post-consultation/appel) est étendu d'une étape parallèle :

```
[Session terminée + transcript persisté]
       ↓
[Analyse coaching praticien]    ──→ scores 10/5 étapes + insights + artefacts
       ↓ (en parallèle, indépendant)
[Analyse psy patient]           ──→ snapshot 6 axes + tags dérivés
       ↓
[UI mise à jour]
```

**Découplage** : try/catch isolé sur le scoring psy. Une erreur ici ne casse pas l'analyse coaching. Les deux étapes lisent le même transcript persisté.

**Re-jouabilité** : le scoring psy peut être relancé sur une session existante sans relancer Deepgram. Utile pour :
- Calibration du prompt en amont
- Recalcul après ajustement des seuils de tags
- Recalcul après changement de version du prompt

### 4.2 Surfaces UI

| Surface | Type | Statut |
|---|---|---|
| Page patient `/patients/[id]` | Modifiée | Carte radar dans l'aside droit + toggle consentement dans header |
| Page admin `/admin/psychology` | Nouvelle | Tableau filtre + export CSV |
| Dashboard pro/assistant `/` | Modifiée | Section « Patients à recontacter » |
| Calibration CLI | Nouveau | Script `pnpm psy:score-session <session_id>` |

## 5. Modèle de données

### 5.1 Nouvelle table

```sql
CREATE TABLE session_psychology_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- 6 axes, échelle 0-10, NULL si non observable
  acceptance_score        SMALLINT,
  motivation_score        SMALLINT,
  trust_score             SMALLINT,
  price_sensitivity_score SMALLINT,
  external_influence_score SMALLINT,
  decision_stage_score    SMALLINT,

  -- Tags dérivés rules-based, multi-tag par snapshot
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Traçabilité IA
  raw_output JSONB NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_psy_session ON session_psychology_snapshots(session_id);
CREATE INDEX idx_psy_patient_recent ON session_psychology_snapshots(patient_id, created_at DESC);
CREATE INDEX idx_psy_tags ON session_psychology_snapshots USING GIN(tags);
```

### 5.2 Colonnes ajoutées à `patients`

```sql
ALTER TABLE patients ADD COLUMN marketing_psy_consent_at TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN marketing_psy_revoked_at TIMESTAMPTZ;
```

**Validité du consentement** : `marketing_psy_consent_at IS NOT NULL AND (marketing_psy_revoked_at IS NULL OR marketing_psy_revoked_at < marketing_psy_consent_at)`. Cette logique est encapsulée dans une fonction TS `hasActiveMarketingConsent(patient)` plutôt qu'en SQL pour réutilisation.

### 5.3 Tables d'audit RGPD

```sql
CREATE TABLE consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  scope TEXT NOT NULL CHECK (scope IN ('marketing_psy')),
  actor_id UUID REFERENCES practitioners(id),
  source TEXT NOT NULL CHECK (source IN ('patient_page', 'admin', 'api')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consent_log_patient ON consent_audit_log(patient_id, created_at DESC);

CREATE TABLE psychology_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES practitioners(id),
  patient_count INTEGER NOT NULL,
  filters JSONB NOT NULL,
  override_non_consenting BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psy_export_actor ON psychology_export_log(actor_id, created_at DESC);
```

`scope` reste un CHECK plutôt qu'un enum SQL pour permettre l'ajout futur de scopes (`research`, `internal_qa`, etc.) sans migration.

### 5.4 Drizzle

Schema TypeScript dans `db/schema/psychology.ts` (snapshots) et `db/schema/consent.ts` (audit). Types Drizzle générés pour `SessionPsychologySnapshot`, `ConsentAuditLog`, `PsychologyExportLog`.

## 6. Logique de scoring

### 6.1 Prompt Claude

**Modèle** : `claude-sonnet-4-5` (qualité prioritaire vs latence ; le scoring tourne post-session, pas en streaming).
**Localisation** : `lib/psychology/prompt.ts` (constante exportable, version trackée).
**Version initiale** : `psy-v1`.

Structure du prompt :

```
Tu es un analyste comportemental spécialisé dans le parcours patient en audioprothèse.
À partir du transcript ci-dessous, score le patient sur 6 axes psychologiques (échelle 0-10).

[Définitions des 6 axes avec exemples comportementaux observables — à itérer pendant calibration]

Règles :
- Score 0-10 si tu as au moins 2 indices observables dans le transcript pour cet axe
- Score null si l'axe n'est pas observable dans cette interaction
- Justifie chaque score par 1-2 phrases + 1 citation extraite du transcript
- Ne pas inférer au-delà du transcript (ex. ne pas supposer qu'un patient âgé est forcément en déni)

Format de sortie : JSON strict
{
  "axes": {
    "acceptance":         {"score": 7, "rationale": "...", "citation": "..."},
    "motivation":         {"score": null, "rationale": "Non observable sur cette session courte", "citation": null},
    ...
  },
  "observed_keywords": ["..."]
}
```

**Inputs** : transcript complet de la session + métadonnées (kind, durée, role du practitioner).

**Outputs persistés** : 6 scores dans les colonnes dédiées + JSON complet dans `raw_output` (pour hover UI affichant rationale + citation, et pour debug calibration).

### 6.2 Règles de tags

Localisation : `lib/psychology/tags.ts`, constante `PSY_TAG_RULES` (array de prédicats).

| Tag (slug) | Condition |
|---|---|
| `prospect-chaud` | `decision_stage ≥ 7 ∧ motivation ≥ 7` |
| `prospect-froid` | `decision_stage ≤ 3 ∧ motivation ≤ 4` |
| `réfractaire-prix` | `price_sensitivity ≥ 7 ∧ decision_stage ≤ 5` |
| `en-déni` | `acceptance ≤ 3` |
| `entourage-décisif` | `external_influence ≥ 7` |
| `méfiant` | `trust ≤ 3` |
| `décisionnaire-éclairé` | `decision_stage ≥ 6 ∧ acceptance ≥ 6 ∧ motivation ≥ 6` |
| `à-rassurer` | `trust ≤ 4 ∧ motivation ≥ 5` |
| `à-éduquer` | `acceptance ≤ 5 ∧ decision_stage ≤ 4` |
| `prêt-conversion` | `decision_stage ≥ 8 ∧ price_sensitivity ≤ 5` |

**Règles de cumul** :
- Un patient peut avoir plusieurs tags simultanément (multi-label)
- Si un axe vaut `null`, toute règle qui en dépend est ignorée pour ce snapshot
- Si tous les axes valent `null`, `tags = []` et le patient n'apparaît dans aucun export
- Le scoring tag se fait à l'INSERT du snapshot (pas calcul dynamique en SQL)

**Priorité d'affichage UI** (quand on n'affiche que 3 tags max sur un radar) : ordre du tableau ci-dessus, top-down. Tous les tags restent en DB pour les exports.

### 6.3 Aggregation globale

Pour un patient donné, son **radar global** est calculé en TS :

```typescript
function computeGlobalRadar(snapshots: SessionPsychologySnapshot[]): GlobalRadar {
  const ordered = [...snapshots].sort((a, b) => b.createdAt - a.createdAt);
  const axes = ['acceptance', 'motivation', 'trust', 'priceSensitivity', 'externalInfluence', 'decisionStage'];
  return Object.fromEntries(
    axes.map(axis => [axis, ordered.find(s => s[axis + 'Score'] !== null)?.[axis + 'Score'] ?? null])
  );
}
```

Logique : pour chaque axe, on parcourt les snapshots du plus récent au plus ancien et on prend la **première valeur non-null trouvée**. Si aucune session n'a jamais scoré cet axe, le radar global a `null` pour cet axe.

**Tags du global** : recalculés à partir du radar global agrégé (pas la concaténation des tags des snapshots individuels). Garantie que les tags reflètent l'état courant synthétisé.

## 7. UI

### 7.1 Page patient `/patients/[id]`

**Layout** : 2 colonnes (inchangé), mais l'aside droit (lg:col-span-5) devient :

```
┌─ Aside droit ──────────────────────┐
│ [ Carte radar psychologique ]      │
│   - Toggle "Évolution sessions"    │
│   - SVG radar 6 axes hexagonal     │
│   - Polygones session 1..N         │
│     (gradient chrono : pâle→vif)   │
│   - Polygone global plein dessus   │
│   - Légende sessions à droite      │
│   - Tags du global sous le radar   │
│                                    │
│ [ Fiche mémoire (vault Karpathy) ] │
│   - Inchangée                      │
└────────────────────────────────────┘
```

**Comportement multi-session** :
- Toggle ON par défaut, montre jusqu'à 3 sessions individuelles + le global
- Toggle OFF : seul le polygone global affiché
- Au-delà de 3 sessions : on garde global + dernière, et un bouton « Voir toute la trajectoire » ouvre un panneau séparé avec mini-graphique d'évolution par axe (composant à créer en v2 si nécessaire ; pour le MVP, on n'affiche que les 3 dernières sessions)
- Hover sur une entrée de la légende : la couche correspondante passe en surbrillance, les autres se grisent
- Hover sur un sommet du polygone global : tooltip avec rationale + citation issues du **snapshot source** (la session la plus récente qui a fourni la valeur de cet axe). Hover sur un sommet d'un polygone session : rationale + citation de cette session précisément.

**Header de la page patient** : ajout d'un toggle de consentement marketing :
```
Consentement marketing analytique : [Activé ✓] depuis le 12 avril 2026
                                    [ Désactiver ]
```
Si désactivé : `[Désactivé] · [Activer]` avec date de révocation visible si elle existe.

### 7.2 Page `/admin/psychology` (nouvelle)

```
┌─ Filtres ────────────────────────────────────────────┐
│ [Tags ▼] [Consentement: actif ▼] [Date dernière session ▼] │
└──────────────────────────────────────────────────────┘
┌─ Tableau patients ───────────────────────────────────┐
│ [✓] Nom         Centre      Dernière sess.   Tags    Mini-radar │
│ [ ] Mme Durand  Lyon 3      22/04/2026     prospect-chaud, ... │
│ [✓] M. Martin   Bordeaux    18/04/2026     réfractaire-prix    │
│ ...                                                              │
└──────────────────────────────────────────────────────┘
[ 47 patients sélectionnés · Exporter CSV ]
```

**Filtre consentement** :
- Default : « consentants uniquement » (pré-sélectionné)
- Switchable vers « tous » avec avertissement modal : « Vous incluez des patients non-consentants. Cet export ne peut pas être utilisé en marketing direct. Confirmer ? ». Action loggée en DB.

**Format CSV exporté** :
```
patient_id, full_name, age, center_name, last_session_date,
tags, acceptance, motivation, trust, price_sensitivity,
external_influence, decision_stage, consent_at
```

Les axes ET les tags exportés sont ceux du **radar global** synthétisé (cf. §6.3), pas du dernier snapshot brut. Garantit qu'un axe non observé sur la dernière session mais scoré sur une session antérieure apparaisse quand même dans l'export.

### 7.3 Dashboard pro/assistant — section « Patients à recontacter »

Position : nouvelle section dans `app/page.tsx` (le dashboard adapté au rôle), entre la heatmap et la table « dernières consultations ».

Contenu :
```
┌─ Patients à recontacter cette semaine (8) ──────────┐
│  M. Martin · Bordeaux · réfractaire-prix            │
│    → Proposer simulation financement                │
│  Mme Lefèvre · Lyon 3 · à-rassurer, méfiant         │
│    → Audit second avis offert                       │
│  ... (3 max affichés, lien "Voir tous (8)")        │
└─────────────────────────────────────────────────────┘
```

**Critères de sélection (par audioprothésiste/centre) :**
- Patient appartient à son centre OU il a une session avec lui
- Consentement marketing actif
- Au moins un tag actionnable parmi : `prospect-chaud`, `prêt-conversion`, `réfractaire-prix`, `à-rassurer`
- Pas de session depuis ≥ 7 jours
- Tri par fraîcheur du dernier tag (plus récent en premier)

**Mapping tag → action suggérée** : constante `PSY_TAG_ACTIONS` dans `lib/psychology/actions.ts`.

## 8. Consentement RGPD

### 8.1 Modèle légal

Consentement à 2 niveaux, exposé dans le formulaire d'accueil patient existant :

1. **Soin (obligatoire)** : couvre transcription, analyse IA pour coaching pro, fiche médicale. Sans ce consentement, la consultation ne peut pas se dérouler dans Clinic OS.
2. **Marketing analytique (optionnel)** : déverrouille l'inclusion du patient dans les exports et segments. Sans ce consentement, le radar existe pour le coaching pro mais le patient n'apparaît dans aucun export.

### 8.2 Comportement système

- Champ `marketing_psy_consent_at TIMESTAMPTZ` : date de consentement explicite
- Champ `marketing_psy_revoked_at TIMESTAMPTZ` : date de révocation
- Le radar (snapshots) est calculé pour TOUS les patients (utilité coaching pro), indépendamment du consentement marketing
- Les EXPORTS ne contiennent que les patients avec consentement actif (sauf override admin avec avertissement et logging)
- La section « Patients à recontacter » du dashboard pro filtre uniquement les consentants

### 8.3 Audit trail

- Toute modification du consentement loggée dans une nouvelle table `consent_audit_log` (patient_id, action `granted`/`revoked`, actor_id, timestamp, source = `patient_page`/`admin`/`api`)
- Tout export marketing loggé dans une nouvelle table `psychology_export_log` (actor_id, timestamp, patient_count, filters appliqués sérialisés en JSONB, override_non_consenting BOOLEAN)

## 9. Calibration en amont

**Phase pré-livraison**, hors scope du dev de la feature.

**Outil** : script CLI `pnpm psy:score-session <session_id>` qui :
1. Charge le transcript de la session depuis la DB
2. Appelle Claude avec le prompt courant
3. Imprime en console le radar produit + tags dérivés + raw output (rationale + citation par axe)
4. N'écrit RIEN en DB (pure dry-run)

**Process** : Raphaël + Jonathan en partage d'écran, lancent le script sur 5-10 sessions seed déjà transcrites. Jonathan critique chaque score (« non, sur cet appel elle n'était pas méfiante, elle était distraite »). Raphaël ajuste le prompt itérativement. Quand validé, on bump `prompt_version = "psy-v2"` et on relance le scoring sur toutes les sessions seed pour générer les snapshots de démo.

## 10. Seed data pour la démo

Tous les snapshots seed sont générés via `pnpm psy:rescore-all` après calibration. À ne pas écrire en dur :

- **30 consultations + 15 appels existants** → 45 snapshots psy
- **Mme Durand (parcours réussi)** : trajectoire visible — appel initial (gris pâle, axes partiels) → consult initiale (rouge clair, ouverture) → consult essai (rouge vif, prêt-conversion). Effet « waouh » radar multi-couches.
- **M. Martin (en cours)** : tag `réfractaire-prix` clair sur consult initiale, le pro a manqué l'objection prix
- **Mme Lefèvre (objection prix non traitée)** : tags `méfiant` + `réfractaire-prix`, candidate parfaite pour la section « patients à recontacter »
- **Consentement marketing** : ~70 % des patients consentants (avec dates variées sur les 3 derniers mois), ~30 % non-consentants (pour montrer le filtre RGPD en action)

## 11. Risques et points ouverts (non-bloquants pour MVP)

| Risque | Mitigation |
|---|---|
| Le prompt sort des scores aberrants sur transcripts pauvres | Logging des cas, ajustement post-calibration |
| Les seuils des tags demandent 1-2 itérations | Constante en code, modifiable sans migration DB |
| Le radar à 4 polygones devient illisible avec >4 sessions | Cap visuel à 3 sessions + global. Bouton « Voir toute la trajectoire » en v2. |
| AI Act 2025 — obligations de documentation supplémentaires | Compliance side-track, hors scope de ce spec |
| Multilingue (FR uniquement pour le MVP) | Conforme au PRD §17, OUT du scope |
| Volume snapshots à terme (millions) | Index appropriés posés. Partitionnement par patient_id en v2 si nécessaire. |

## 12. Hors scope explicite

- **Tags LLM-generated** (free-form depuis taxonomie curée) — gardé en roadmap (Approche 2)
- **Page calibration UI** `/admin/psychology/calibration` — remplacée par CLI dans le MVP
- **Intégration ESP réelle** (Brevo, Mailchimp, Salesforce) — CSV uniquement pour le MVP
- **API webhook HQ Amplifon** — roadmap, pas MVP
- **Mini-graphique d'évolution par axe** (small multiples) — v2 si > 4 sessions par patient
- **Lint automatique des snapshots** (détection contradictions, vieilles données) — v2

## 13. Critères de succès

- Un patient ayant eu au moins une session a un radar 6 axes affiché sur sa page
- Un patient ayant eu plusieurs sessions affiche un radar global synthétisé + couches individuelles avec gradient chronologique
- Le toggle de consentement marketing fonctionne, est daté, et filtre les exports
- L'export CSV produit un fichier exploitable avec les colonnes attendues
- La section « Patients à recontacter » liste 3-5 patients pertinents par dashboard pro
- Le script CLI de calibration tourne sur une session existante et imprime un radar valide
- Les 45 sessions seed ont chacune un snapshot psy après `pnpm psy:rescore-all`
- Mme Durand affiche une trajectoire visible et inspirante en démo
- M. Martin et Mme Lefèvre apparaissent dans la section « Patients à recontacter » avec les bons tags

## 14. Estimation

**Dev focalisé** : 6-8 heures
**Calibration Jonathan** (hors dev) : 1-2 heures additionnelles
**Buffer prompt** : itérations supplémentaires possibles sur la qualité du scoring

Total : **~1 journée** de Raphaël + Claude en pair, plus la calibration Jonathan en partage d'écran.
