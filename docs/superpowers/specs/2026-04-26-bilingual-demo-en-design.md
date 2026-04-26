# Spec — Démo bilingue FR/EN

**Date** : 2026-04-26
**Contexte** : MVP J9 stretch terminé, déployé prod, 100 % FR. Jonathan doit pouvoir présenter devant un public anglophone.
**Objectif** : démo jouable bout-en-bout en anglais sans accroc, équivalente en richesse à la démo FR.
**Effort visé** : 2.5 - 3 jours.

---

## Périmètre

### IN
- Sélecteur EN/FR dans le header (persisté en cookie `NEXT_LOCALE`)
- Internationalisation UI via `next-intl` v3 (Next.js 15 App Router)
- Prompts IA paramétrés par locale (sortie EN si user en EN)
- 1 consultation TTS EN équivalente à Mme Durand → **Mrs. Davis** (cas excellent, ~88)
- 1 appel TTS EN équivalent à M. Lefranc → **Mr. Wilson** (cas perdu chiffré ~6 350 €)
- 2-3 patients fictifs anglophones + 2 centres EN + 2 pros EN dans les seeds
- Devise : euro (€) maintenu quel que soit la langue

### OUT
- Routes localisées (`/en/...` `/fr/...`) — toggle au runtime via cookie suffit
- Italien, espagnol, allemand (architecture compatible mais hors scope MVP)
- Traduction des 30 consultations + 15 appels seeds historiques (restent FR)
- Traduction des fiches Karpathy existantes (les nouvelles s'écrivent en locale courante)
- Traduction base de connaissances Layer A (reste FR — argumentaire : contenu Amplifon France)
- Conversion devises (€ → £/$)

### Compromis assumés (à expliquer en démo)
1. **Base de connaissances reste FR** — "in production, each market ingests its own training content"
2. **Cmd+K cross-language** — user EN → voyage-3-lite (multilingue) matche chunks FR → réponse EN. Sources cliquables (vidéos/PDFs Drive) restent FR.
3. **Sessions historiques restent FR** dans la table dashboard EN — défendable en prod
4. **Devise euro** — argument commercial Amplifon (multinationale, calibrage € existant)

---

## Architecture

### Stack i18n
- **Lib** : `next-intl` v3 (standard Next.js 15 App Router, supporte RSC + Client Components, streaming)
- **Storage messages** : `messages/fr.json` + `messages/en.json` à la racine
- **Provider** : `NextIntlClientProvider` autour de l'app dans `app/layout.tsx`
- **Detection** : middleware lit le cookie `NEXT_LOCALE`, défaut `fr`
- **Pas de routing localisé** : URL identiques

### Flow bascule de langue
1. User clique `<LocaleSwitch />` dans le header
2. Server Action `setLocale(next)` → `cookies().set('NEXT_LOCALE', next)` + `revalidatePath('/', 'layout')`
3. Server rerender avec messages cibles
4. Client Components récupèrent `useTranslations()` automatiquement

### Locale dans l'IA
- Helper central `lib/i18n/llm.ts` :
  ```ts
  export function getLocaleInstruction(locale: 'fr' | 'en'): string
  export function getSpeakerLabels(kind: 'consultation' | 'phone_call', locale): { pro: string, patient: string }
  ```
- Chaque prompt système commence par `getLocaleInstruction(locale)` :
  > "Respond in English. All output (artifacts, insights, scores rationale, vault updates) must be in English. Use English speaker labels in transcript: 'Practitioner' / 'Patient' (or 'Front desk' / 'Caller' for phone calls)."
- Locale stockée dans `sessions.metadata.locale` au moment de la création (live ou replay)
- Lors d'une régénération d'artefact, on relit `metadata.locale` pour rester cohérent

### Frameworks (consultation 10 étapes, phone v3 6 étapes)
- Étendre `lib/frameworks.ts` : ajouter `name_en` + `description_en` à chaque étape
- Helper `getFrameworkLocalized(kind, locale)` retourne version locale courante
- UI utilise toujours la version localisée via translations

### Speaker labels (centralisés)
| | FR | EN |
|---|---|---|
| Consultation | Pro / Patient | Practitioner / Patient |
| Phone | Standardiste / Appelant | Front desk / Caller |

### Phone tags labels (4 dimensions)
- Étendre `lib/phone-tags.ts` : ajouter `labels_en` à côté du `labels` FR existant
- 4 dimensions × 5-7 valeurs ≈ 25 traductions

### Devise
- Format unique via `Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })`
- EN : "€1,800" / FR : "1 800 €" — variation typographique acceptée

### Dates
- `Intl.DateTimeFormat(locale)` pour affichage relatif et absolu

---

## Contenus EN à produire

### TTS audios EN (ElevenLabs `eleven_turbo_v2_5`)
| FR | EN | Voix | Durée |
|---|---|---|---|
| Mme Durand | **Mrs. Davis** (cas excellent ~88) | Voix EN pro féminine + voix EN senior féminine | ~6 min |
| M. Lefranc | **Mr. Wilson** (appel perdu, anonyme, ~6 350 €) | Voix EN front desk + voix EN senior masculin | ~1.5 min |

Fichiers stockés dans Supabase Storage bucket `replays-en/`.
Scripts : `scripts/replay/scripts-consultation-en.ts`, `scripts/replay/scripts-phone-en.ts`.
Seed : `pnpm seed:replay-en`.

### Seeds EN
- **2 centres** : "London Bridge", "Manchester Central"
- **2 pratitiens** : "Dr. Sarah Mitchell" (audioprothésiste), "James Carter" (assistant)
- **2-3 patients** : Mrs. Davis (parcours timeline complet), Mr. Wilson (timeline phone), +1 si besoin

### Strings UI
- Estimation 200-300 strings
- Namespaces : `nav.*`, `dashboard.*`, `consultation.*`, `phone.*`, `vault.*`, `catalogue.*`, `admin.*`, `common.*`

---

## Découpage du chantier

### Phase 1 — Plomberie i18n (1 jour)
- Install `next-intl@^3`
- Configurer middleware + provider dans `app/layout.tsx`
- Créer `messages/fr.json` (extraction strings UI existantes, namespace par feature)
- Créer `messages/en.json` (traduction)
- Composant `<LocaleSwitch />` dans le header (icône globe à côté du toggle rôle)
- Server Action `setLocale(next)` avec cookie + `revalidatePath`

### Phase 2 — Adaptation IA (0.5 jour)
- Créer `lib/i18n/llm.ts` : `getLocaleInstruction`, `getSpeakerLabels`
- Adapter prompts : `lib/analysis/analyze.ts`, `coach-tick.ts`, `vault-update.ts`, `artifacts/*.ts` (×4), `app/api/search/route.ts`
- Ajouter `metadata.locale` à la création de session (live + replay)
- Lecture `metadata.locale` lors de régénération artefacts
- Étendre `lib/frameworks.ts` avec `name_en` + `description_en`
- Étendre `lib/phone-tags.ts` avec `labels_en`

### Phase 3 — Contenu démo EN (1 jour)
- Écrire `scripts/replay/scripts-consultation-en.ts` (Mrs. Davis, ~6 min, cible 88)
- Écrire `scripts/replay/scripts-phone-en.ts` (Mr. Wilson, ~1.5 min, cible 38)
- Générer audios TTS via ElevenLabs (cache obligatoire — coût ~30-50 €)
- Upload vers Supabase Storage bucket `replays-en/`
- Seeds : `scripts/seed-replay-en.ts` (centres + pros + patients + sessions)
- Adapter `<NewSessionButton>` : afficher cartes EN si locale=en, FR sinon

### Phase 4 — Polish + répétition (0.5 jour)
- Grep large strings hardcodées oubliées
- Tour manuel UI EN sur tous les flows démo (dashboard pro/assistant, Cmd+K, consultation live + replay, résultats, livrables, vault, timeline patient)
- Test Cmd+K EN sur 5 questions clés
- Vérification format devise EUR EN
- Smoke E2E EN complet : toggle EN → Mrs. Davis → analyse → résultats → livrables → mémoire → export Obsidian

**Total : 2.5 - 3 jours**

---

## Données

### Modifications schéma DB
- Aucune migration SQL nécessaire (`sessions.metadata` est déjà `jsonb`)
- Ajout clé `locale: 'fr' | 'en'` dans `metadata`

### Pas d'impact sur
- `transcript_lines`, `session_scores`, `coaching_insights`, `session_artifacts` (contenu en langue de la session)
- `knowledge_chunks` (restent FR)
- `vault_pages` (markdown freeform)
- `ingestion_runs`

---

## Tests

### Smoke E2E EN
1. Toggle EN au démarrage
2. Home audioprothésiste : KPIs, table sessions, nudges en EN
3. Sidebar + header EN
4. Cmd+K : "patient refusing premium hearing aids" → réponse EN + sources FR
5. New consultation → carte Mrs. Davis → live replay EN, transcript EN, coaching EN
6. Fin session → analyse → résultats EN (score, radar, insights EN avec €)
7. Livrables : Clinical notes, Patient email, Patient SMS, ENT specialist letter
8. Mémoire : nouvelle fiche vault EN
9. Toggle FR au milieu : UI repasse FR, données restent (session.metadata.locale='en' immuable)
10. Export Obsidian : zip OK avec mix FR/EN selon date de création

### Tests unitaires
- `getLocaleInstruction(locale)` × 2
- `getSpeakerLabels(kind, locale)` × 4 combinaisons
- `getFrameworkLocalized(kind, locale)` × 2 frameworks × 2 locales
- Format devise EN/FR

---

## Risques

| Risque | Mitigation |
|---|---|
| Qualité voix EN ElevenLabs | Tester 2-3 voix par persona en J1, écoute Jonathan, choix avant production complète |
| Cmd+K cross-language qualité | Test 5 questions EN J1 → si insuffisant, ajout étape "question rewriting" FR via Haiku 1 appel |
| Strings hardcodées oubliées | Grep large + tour manuel par flow démo |
| Régression FR | Extraction module par module + tests E2E FR avant/après |
| Coût démo EN x2 | Estimé ~5 $ vs 3 $ — budget OK |

---

## Conventions

- Strings UI : `useTranslations()` (Client) ou `getTranslations()` (Server)
- Helper IA : `getLocaleInstruction()` dans `lib/i18n/llm.ts`
- Messages structurés par namespace `nav.*`, `dashboard.*`, etc.
- Pas de string EN hardcodée dans le code TS
- Patients/centres/pros EN dans `scripts/seed-replay-en.ts`

---

## Hors scope explicitement reporté

- Routes localisées
- Italien, espagnol, allemand
- Traduction des seeds historiques
- Traduction du vault existant
- Traduction Layer A
- Conversion devises
- RTL (hébreu, arabe)
