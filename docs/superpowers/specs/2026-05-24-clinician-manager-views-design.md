# Clinician Insight + Manager Dashboard — Design (spec)

> Démo Amplifon le 2026-05-26. Second chantier (après la refonte page patient).
> Maquettes de référence fournies par Raphaël : `clinician_insight.html`, `manager_dashboard.html`
> (elles définissent le contenu/structure ; charte rouge Clinic OS conservée).

## Objectif

Deux écrans qui montrent la valeur « enablement réseau » côté professionnels, en logique **qualité de soin** (pas de vente) :

1. **Clinician Insight** — miroir de développement **privé** du clinicien : un radar 6 axes de qualité de soin, calculé sur ses propres consultations. Intégré au **dashboard** audioprothésiste.
2. **Manager Dashboard** — vue **agrégée et anonyme** d'équipe sur les mêmes 6 axes (moyennes + distribution, jamais d'individu nommé). Rangé sous **Admin**.

## Décisions de cadrage (validées)

- **Clinician = réel** : 6 axes générés par IA depuis les vraies consultations de Jonathan.
- **Manager = seedé** : on n'a pas 9 cliniciens réels → on seed ~8 praticiens fictifs avec des snapshots care, puis le dashboard **agrège** (moyenne + distribution). Effet « agrégation réelle » sans fabriquer des transcripts.
- **Accès** : Clinician Insight = section du dashboard (`/`) ; Manager Dashboard = page Admin (`/admin/manager`). Pas de nouveau rôle « manager », pas de 3e persona.
- **Bilingue FR/EN** : libellés via i18n ; rationales par axe générées en FR **et** EN (démo anglophone).

## Les 6 axes care-quality

Distincts du framework 10 étapes (vente) et des dimensions patient. Échelle **0-100**.

| clé | FR | EN | définition (1 ligne) |
|---|---|---|---|
| `rapport` | Relation | Rapport | Confiance et chaleur — le patient se sent entendu. |
| `pedagogy` | Pédagogie | Pedagogy | Explication claire — complexité rendue compréhensible. |
| `structure` | Structure de consultation | Consultation structure | Une visite complète et rigoureuse (étapes clés présentes). |
| `guidance` | Clarté de l'accompagnement | Guidance clarity | Aide le patient à bien décider (jamais « closer »). |
| `followThrough` | Suivi | Follow-through | Continuité après la visite — le patient ne se sent pas abandonné. |
| `adaptability` | Adaptabilité | Adaptability | S'adapte à des styles de patients très différents. |

Chaque axe affiche, au clic, **Captures / Sert à** (copie fixe, identique pour tous, transcrite des maquettes en FR+EN). Le cadrage « Not this » des maquettes (ex. « never closing a sale ») est conservé comme garde-fou textuel.

**Chaîne de valeur** (footer Clinician Insight) : « Meilleure compréhension → meilleur soin → meilleure satisfaction patient » — la satisfaction est un résultat, jamais une cible imposée.

## Architecture des données

Table additive `practitioner_care_snapshots` (1 ligne / praticien), même méthode que `patient_relationship_synthesis` :

```
id uuid PK
practitioner_id uuid UNIQUE → practitioners.id (cascade)
rapport_score smallint            -- 0-100, nullable
pedagogy_score smallint
structure_score smallint
guidance_score smallint
follow_through_score smallint
adaptability_score smallint
rationale jsonb                   -- { rapport: {fr, en}, ... } 1 phrase/axe/langue
source text                       -- 'ai' | 'seed'
model text
prompt_version text
raw_output jsonb
updated_at timestamptz
```

N'affecte aucune table existante. Appliquée via migration relue (Supabase MCP `apply_migration`), pas de `db:push`.

## Écran 1 — Clinician Insight (section dashboard, réel)

- Rendu dans une section du dashboard audioprothésiste (`/`), sous les KPIs existants.
- **Radar 6 axes** : réutilise le composant radar SVG existant (`components/patients/psychology-radar.tsx`) reconfiguré sur les 6 axes care (hexagone déjà prévu pour 6 axes).
- **Panneau détail** par axe (clic) : titre + sous-titre + Captures + Sert à (copie i18n).
- **Bandeau confidentialité** : « Privé au clinicien — le manager voit des niveaux et zones de progression, jamais vos ventes, conversions ou données patient, rien qui serve à classer ou sanctionner. »
- Affiché **uniquement** pour le rôle audioprothésiste (l'assistant n'a pas de consultations) ; sinon section masquée.
- Identité : le clinicien courant = praticien par défaut du rôle (Jonathan Goldminc, cf. `lib/quiz-identity.ts`).

**Génération** : `scripts/clinician-generate.ts` — 1 appel IA **tool_use** (Sonnet) sur le verbatim de toutes les consultations du praticien → 6 scores + rationale FR/EN par axe. Stocké `source='ai'`. Robuste (tool_use, comme la synthèse patient).

## Écran 2 — Manager Dashboard (Admin, seedé/agrégé)

- Route `/admin/manager`, entrée dans `ADMIN_NAV` (`lib/nav-config.ts`).
- **Radar agrégé** : moyenne d'équipe par axe (même composant radar).
- **Distribution par dimension** : barres empilées montrant combien de cliniciens par palier — paliers `signature` (force) / `solid` / `developing` — « combien, jamais qui ».
- **Bandeaux** : « Toujours agrégé » (thèmes, pas d'individus) / « Jamais visible » (pas de radar nominatif, pas de scores individuels, pas de classement — la vue individuelle appartient au clinicien).
- **Données** : agrégation calculée sur tous les `practitioner_care_snapshots` du centre (Jonathan IA + ~8 fictifs seedés). Aucune donnée nominative affichée.

**Seed** : `scripts/seed-care-team.ts` — insère ~8 praticiens fictifs (centre Lyon 3) + leurs snapshots care (6 scores plausibles, `source='seed'`, pas de rationale requise). Idempotent.

## i18n

Nouveaux namespaces `clinicianInsight` et `managerDashboard` dans `messages/fr.json` + `messages/en.json` : libellés d'axes, sous-titres, Captures/Sert à par axe, bandeaux confidentialité, libellés de paliers de distribution, chaîne de valeur. Rationales par axe = stockées bilingues en base (pas i18n), affichées selon la locale (fallback FR), comme la synthèse patient.

## Réutilisations / patterns existants

- Radar SVG : `components/patients/psychology-radar.tsx` (hexagone 6 axes, multi-layers) — reconfiguré.
- Génération IA tool_use : pattern de `lib/relationship/generate.ts`.
- Migration additive : Supabase MCP `apply_migration` (projet `geyyfrqloisqgfmapqjk`).
- Nav : `lib/nav-config.ts` (ADMIN_NAV) + route `app/admin/manager/page.tsx`.

## Hors scope (post-démo)

Vrai rôle « manager » + permissions, identité multi-praticien réelle, génération IA des axes pour toute l'équipe (au-delà de Jonathan), historique/évolution des axes dans le temps, lint vault, export.

## Risques

Faible : tout est **additif** (nouvelle table, nouveaux écrans, nouveaux scripts), aucun impact sur le pipeline existant (analyse, scoring, dashboard KPIs actuels, page patient). Principal point d'attention : la qualité/cohérence des 6 axes générés par l'IA pour Jonathan — à relire après génération avant la démo.
