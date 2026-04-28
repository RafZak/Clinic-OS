# Clinic OS — MVP de démo (PRD v2)

> Document de référence du projet. À lire au démarrage de chaque session Claude Code.
> Version 2 — 23 avril 2026.

**Fichiers complémentaires à charger uniquement quand nécessaire** :
- `docs/schema.sql` — schéma SQL complet (à utiliser pour les migrations Drizzle au J1)
- `docs/prompts.md` — prompts IA détaillés (à utiliser à partir de J6 pour l'analyse, J8 pour les artefacts)

---

## 1. Vision produit

### Promesse à Amplifon

**Clinic OS est la plateforme d'enablement d'un réseau d'audioprothèse** : elle fait progresser les ventes en équipant audioprothésistes ET assistants d'une couche d'IA ambiante qui accompagne leur parcours client de bout en bout.

Pas un LMS. Pas un outil de coaching isolé. Une **couche de renseignement ambiant** qui transforme les interactions déjà en train d'avoir lieu (appels, consultations) en données exploitables pour monter le niveau collectif du réseau.

Objectif business pour Amplifon : **+2 % de taux de conversion sur 10 000 centres = 480 M€/an de CA additionnel.**

### Philosophie produit (3 principes non-négociables)

1. **Ambiance > Friction.** L'utilisateur ne doit rien changer à sa pratique. À terme même le bouton "Démarrer l'enregistrement" disparaît (calendrier métier, détection présence). Pour le MVP on garde un bouton, mais le discours démo assume la cible ambiante.

2. **Compound > Snapshot.** Chaque interaction enrichit une mémoire organisationnelle. L'IA ne repart pas de zéro à chaque session. Pattern inspiré du **LLM Wiki de Karpathy** (cf. section 6 Layer B).

3. **Parcours > Événement.** Un patient n'est pas "une consultation", c'est un parcours de plusieurs semaines. L'IA suit la timeline, pas chaque événement isolément.

### Les 2 piliers

**Pilier 1 — Knowledge Platform** : moteur de recherche sémantique en langage naturel. L'utilisateur tape une situation métier ("patient qui refuse la classe 2 pour raison financière") → réponse IA synthétisée + sources (modules, livrets, vidéos avec timestamp).

**Pilier 2 — AI Copilot** : coaching ambiant qui accompagne audioprothésistes ET assistants tout au long du parcours client (consultations + appels téléphoniques entrants), avec scoring framework, 4 artefacts post-consultation, mémoire organisationnelle.

**Le dashboard business** n'est pas un 3e pilier — c'est la vitrine. Il affiche les KPIs business qu'Amplifon veut voir bouger : taux d'appareillage, panier moyen, taux de conversion téléphonique.

---

## 2. Contexte du projet

**Jonathan Goldminc** (audioprothésiste, co-fondateur d'Audiome, 15 ans terrain) et **Raphaël Zakine** (co-fondateur d'Audiome) portent le projet. Premier prospect : **Amplifon** (10 000+ centres mondialement).

Une **landing de pitch** existe déjà (`/mnt/project/index-fr.html`) qui décrit les promesses. Le produit lui-même **n'existe pas**. Jonathan a besoin de la démo pour vendre.

**Ce qu'on construit en 10 jours** : un MVP démontrable pour 30-45 min de présentation à Amplifon. Pas un produit final — une démo qui donne envie d'acheter. Jonathan pilote en partage d'écran.

**Délai** : 10 jours calendaires à partir du 24 avril 2026 (potentiellement plus rapide selon vélocité dev).

### Critères de succès démo

À J10, Jonathan doit pouvoir jouer sans bug : (1) ouvrir dashboard rempli, (2) recherche en langage naturel → réponse IA + ouvrir vidéo au timestamp, (3) consultation live roleplay avec transcription + scoring, (4) résultats + 4 artefacts générés, (5) replay "objection prix non traitée", (6) timeline patient fictif, (7) toggle vue Assistant accueil, (8) ouvrir Obsidian sur vault markdown, (9) roadmap, (10) Q&A.

**Si les étapes 2, 3, 4, 6 plantent → la démo est ratée.** Priorité absolue à leur robustesse.

---

## 3. Utilisateurs

**2 personas** accessibles via toggle de rôle en header (pas d'auth, simulation).

### Persona A — Audioprothésiste
Professionnel de santé + vendeur conseil. 25-60 ans, formation longue, très technique. 4-8 consultations/jour, 45-60 min chacune. Veut progresser sans perdre de temps, valorise reconnaissance métier, méfiant des outils managériaux intrusifs.
Accède à : Dashboard, Consultations, Knowledge Platform, Timeline patient, Admin.

### Persona B — Assistant accueil
Premier contact patient : accueil centre, appels entrants, prise RDV, relances. Formation courte, polyvalent. **80 % des opportunités meurent au premier appel** — d'où l'enjeu critique. Veut scripts efficaces et feedback clair.
Accède à : Dashboard adapté, Appels entrants (stretch), Knowledge Platform, Timeline patient.

### Tonalité IA coach
**Vouvoie** l'utilisateur, ton **professionnel, factuel, bienveillant sans complaisance**. Pas un coach perso chaleureux — un manager senior respectueux. Coache **l'utilisateur**, jamais le patient. Ne jamais confondre dans les prompts.

---

## 4. Stack technique imposée

| Couche | Choix | Raison |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | SSR + API routes + Vercel |
| UI | Tailwind + shadcn/ui | Rapide, customizable |
| BDD | Supabase Postgres + pgvector | Hébergé, vectoriel inclus |
| Storage | Supabase Storage | Audios + PDFs + vault markdown |
| Auth | **Aucune** | Toggle de rôle factice |
| Transcription | Deepgram Nova-3 (`nova-3-general`, `fr`) streaming | Latence < 500 ms, FR excellent |
| LLM principal | Claude Sonnet 4.5 (`claude-sonnet-4-5`) | Analyse + coaching + wiki |
| LLM rapide | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Artefacts, recherche |
| Embeddings | `voyage-3-lite` (Voyage AI) | Coût/perf français |
| TTS démo | ElevenLabs (`eleven_turbo_v2_5`, voix FR) | Voix réalistes replays |
| ORM | Drizzle | Typage fort Supabase |
| Déploiement | Vercel | Continuité landing |
| Knowledge formation | Google Drive (`Clinic OS JG+RZ/Originaux/`) | Source de vérité |

### Variables d'environnement

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# IA
ANTHROPIC_API_KEY=
DEEPGRAM_API_KEY=
VOYAGE_API_KEY=
ELEVENLABS_API_KEY=
# Google Drive (ingestion)
GOOGLE_DRIVE_CLIENT_EMAIL=
GOOGLE_DRIVE_PRIVATE_KEY=
GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID=
```

---

## 5. Charte graphique

Transposer directement de `/mnt/project/index-fr.html` :

```css
--red: #CC0641;       /* primary Amplifon */
--dark-red: #A50534;
--dark: #1A1A1A;
--white: #FFFFFF;
--light: #F5F7F8;
--gray: #6B7280;
--border: rgba(0,0,0,.09);
```

Police **Inter** (300-900). Pour pages catalogue formation, clin d'œil au design **AUDIO Académie** (typo plus fine, accent doré discret). Pas d'emojis. Icônes via **lucide-react** uniquement.

---

## 6. Les 2 layers de knowledge — POINT ARCHITECTURAL CENTRAL

**Ne pas confondre les deux. Ils se complètent, ne se remplacent pas.**

### Layer A — Formation Knowledge Base (RAG classique)

**Contenu statique.** Les 4 programmes de formation ingérés depuis Google Drive : Reference (8 modules sur Recommandation), Personnel Accueil, Convaincre au téléphone, Audio Vente.

Stockage : `knowledge_chunks` (Postgres + pgvector). Embeddings voyage-3-lite. Mise à jour : re-ingestion Drive 2×/jour (cron) ou manuelle via admin.

Utilisé par :
- **Moteur de recherche Pilier 1** (requête user → retrieval → réponse IA + sources)
- **Coaching IA** pour citer les bonnes pratiques quand il analyse une consultation

### Layer B — Organizational Memory (pattern Karpathy)

**Contenu dynamique.** Mémoire vivante du réseau, maintenue par l'IA après chaque interaction. Structure LLM Wiki :

```
vault/
├── index.md
├── practitioners/   # 1 fiche par audioprothésiste
├── assistants/      # 1 fiche par assistant accueil
├── centers/         # 1 fiche par centre
├── patients/        # 1 fiche par patient fictif démo
├── patterns/        # patterns récurrents détectés
└── sessions/        # 1 fiche par session analysée
```

Chaque fichier = markdown avec **front matter YAML + contenu + `[[wikilinks]]`**.

Exemple fiche audioprothésiste :

```markdown
---
type: practitioner
center: [[lyon-3]]
sessions_analyzed: 27
avg_score: 76
trend: improving
---

# Jonathan Goldminc

**Synthèse** : Audioprothésiste expérimentée, excellente en relation patient (étape 3 : 89/100 moyen). Point de friction récurrent sur l'étape 7 (Objections) — tendance à éluder l'objection prix.

## Forces récurrentes
- Identification des besoins (citations concrètes du patient)
- Présentation technique vulgarisée

## Points d'amélioration
- Traitement objection prix — cf. [[objection-prix-non-traitee]]
- Montée en gamme non proposée 60 % cas éligibles

## Sessions récentes
- [[session-abc123]] — Mme Durand, 88/100
```

**3 opérations** :
- **Ingest** : après chaque session analysée, Claude met à jour 3-4 fiches concernées
- **Query** : quand l'IA coach prépare une analyse, elle charge la fiche de l'audioprothésiste en contexte → "sait" ses forces/failles
- **Lint** : audit mensuel, hors scope MVP, en roadmap

Stockage : **Supabase Storage** (fichiers .md) + indexation metadata dans Postgres (`vault_pages`).

**Visualisation** : page `/admin/vault` (rendu markdown + backlinks cliquables + graph view simple). **Export Obsidian** (zip download du vault) — argument fort en démo pour montrer transparence à Amplifon.

---

## 7. Pipeline ingestion Drive (Layer A)

**Worker** : script CLI `pnpm ingest` + endpoint `POST /api/admin/ingest` (déclenchement manuel UI).

Logique :
1. Auth Google Drive (Service Account)
2. List récursif `Clinic OS JG+RZ/Originaux/`
3. Pour chaque fichier :
   - Si déjà en base avec même `drive_modified_at` → skip
   - **PDF** → download + pdf-parse + chunking sémantique 500-800 tokens, overlap 100
   - **MP4** → download + Deepgram batch transcription FR + chunking par segments 30 s avec timestamps
   - **DOCX** → mammoth + chunking
   - **.key** → skip (Jonathan exporte en PDF manuellement)
4. Pour chaque chunk → embedding voyage-3-lite → upsert `knowledge_chunks`
5. Log dans `ingestion_runs`

**Convention nommage Drive** : `SBL_<Programme>_module_<N>_livret_<M>.pdf`. Le worker parse le nom de fichier pour rattacher au bon programme/module.

**Admin `/admin/knowledge`** : tableau chunks filtrable, KPIs, bouton "Re-ingérer", upload manuel, historique runs, **test de retrieval** (champ texte → top-5 chunks + scores, debug précieux).

---

## 8. Schéma de données

**15 tables.** Voir `docs/schema.sql` pour le SQL complet, prêt à convertir en migrations Drizzle.

Tables principales :
1. `centers` — centres fictifs (FK référencée par practitioners)
2. `practitioners` — users avec champ `role` ("audioprothesiste" | "assistant")
3. `programs` — 10 cartes catalogue dont 4 actives
4. `modules` — modules dans un programme
5. `livrets` — PDFs rattachés aux modules
6. `patients` — patients fictifs pour démo timeline
7. `sessions` — **unifié** consultations ET appels (champ `kind`)
8. `transcript_lines` — Deepgram output
9. `session_scores` — scoring par étape framework
10. `coaching_insights` — insights IA avec `estimated_impact_eur`
11. `session_artifacts` — 4 artefacts post-consultation
12. `patient_events` — timeline parcours patient (lien vers sessions)
13. `knowledge_chunks` — Layer A RAG (vector(1024) + ivfflat)
14. `vault_pages` — Layer B Karpathy (markdown + metadata + backlinks)
15. `ingestion_runs` — logs ingestion Drive

**Décisions de modélisation importantes** :
- `sessions` unifiée pour consultations + appels (champ `kind`) → permet réutilisation max de code
- `practitioners` unifiée pour audioprothésistes + assistants (champ `role`)
- `vault_pages` indexe le markdown stocké dans Storage (path = clé)
- Pas de soft-delete pour le MVP

---

## 9. Frameworks de scoring

### Framework "Consultation" (10 étapes)

Issu du module 8 d'Audio Vente. Référence métier.

```typescript
const CONSULTATION_FRAMEWORK = [
  { number: 1, name: "Préparation", description: "Conditions d'accueil physiologiques et matérielles" },
  { number: 2, name: "Introduction", description: "Se présenter, valider l'agenda" },
  { number: 3, name: "Identification des besoins", description: "Échanger pour identifier besoins" },
  { number: 4, name: "Présentation", description: "Présenter les options en vulgarisant" },
  { number: 5, name: "Bilan et démonstration", description: "Adapter les tests, donner avant-goût" },
  { number: 6, name: "Recommandation", description: "Dévoiler la solution adaptée" },
  { number: 7, name: "Objections", description: "Accueillir comme un signe d'intérêt" },
  { number: 8, name: "Conclusion", description: "Résumer engagements pris" },
  { number: 9, name: "Décontraction", description: "Note humaine" },
  { number: 10, name: "Suivi", description: "Sécuriser contre la concurrence" },
];
```

### Framework "Appel entrant" (5 étapes)

Déduit du programme "Convaincre au téléphone". **À affiner avec Jonathan avant J5.**

```typescript
const PHONE_CALL_FRAMEWORK = [
  { number: 1, name: "Décrochage", description: "Ton, accroche, présentation centre" },
  { number: 2, name: "Identification du besoin", description: "Comprendre pourquoi le patient appelle" },
  { number: 3, name: "Traitement objection initiale", description: "Prix, doute, procrastination" },
  { number: 4, name: "Proposition de RDV", description: "Transformer l'appel en RDV confirmé" },
  { number: 5, name: "Confirmation et ancrage", description: "Engagement, next steps, rappel" },
];
```

Score 0-100 par étape + rationale + citations. Score `null` si étape non couverte (pas 0).

---

## 10. Les 4 artefacts post-consultation

Générés en parallèle à la fin de l'analyse (Claude Sonnet 4.5 ou Haiku selon artefact). Alimentés par : transcript + scores + insights + **fiche Karpathy de l'audioprothésiste** (personnalisation).

- **Notes cliniques** : markdown structuré (motif, antécédents, audiogramme, options, décisions, next steps)
- **Email patient** : objet + corps HTML, chaleureux pro, CTA contextuel
- **SMS patient** : ≤ 140 caractères, direct
- **Courrier ORL** : format courrier médical pro

Tous **copiables** et **régénérables**. Présentés comme "prêts à envoyer vers Cosium / Outlook / SMS Gateway" — **pas de vraie intégration**, valorisation visuelle uniquement.

Prompts détaillés dans `docs/prompts.md`.

---

## 11. User flows principaux

### Flow 0 — Onboarding
Toggle rôle dans header → choix persisté en cookie → dashboard adapté.

### Flow 1 — Recherche knowledge (Pilier 1)
Barre Cmd+K toujours visible → user tape question → modal résultats : **réponse IA synthétisée** (style Perplexity) en haut + **sources cliquables** en dessous (vidéo s'ouvre au timestamp, PDF à la page).
Implémentation : retrieval voyage top-12 → Claude Haiku génère synthèse + citations en streaming.

### Flow 2 — Consultation live
Dashboard → "+ Nouvelle consultation" → modal Live/Replay → page consultation 3 colonnes : **transcription streaming** + **scoring 10 étapes en live** (vert/orange/rouge) + **insights détectés au fil de l'eau** → bouton Terminer → page résultats.

### Flow 3 — Consultation replay
Modal Démo → 3 cartes (Mme Durand 88, M. Martin 65, Mme Lefèvre 48) → même page que live, audio joué depuis Storage, transcription déroulée selon timestamps stockés.

### Flow 4 — Page résultats
Header : patient, durée, score global, badge "+480 € opportunités détectées". 5 onglets :
1. Vue d'ensemble : radar 10 étapes + 3-5 insights majeurs chiffrés
2. Transcription : lignes + annotations IA en marge
3. Coaching : insights triés par sévérité + citations Layer A
4. Livrables : 4 cartes artefacts + Copier + Régénérer
5. Mémoire : lien vers fiche Karpathy de l'audioprothésiste

### Flow 5 — Timeline parcours patient
Sidebar → Patients → clic "Mme Durand" → timeline verticale : appel entrant → RDV pris → consultation → essai → livraison → suivi téléphonique. Chaque événement cliquable (replay + analyse). Panneau latéral : fiche Karpathy patient.
**Pour démo** : 2 patients fictifs entièrement seedés avec événements + analyses pré-calculées.

### Flow 6 — Appels entrants (stretch goal)
Dashboard assistant → liste appels avec score + résultat (RDV pris/perdu) → clic → page identique à consultation mais framework 5 étapes.
Livré en mode replay si temps permet (J9 aprem).

### Flow 7 — Catalogue formation
Sidebar → Catalogue → grille 10 cartes par catégorie (4 actives, 6 "Bientôt disponible") → clic carte active → page programme : header + modules en accordéon (description + player vidéo + livrets PDF téléchargeables).

### Flow 8 — Admin Knowledge
Cf. section 7.

### Flow 9 — Admin Vault
Sidebar → Admin → Vault → navigation par dossier → clic fiche : rendu markdown + backlinks cliquables → bouton Graph view (force-directed simple D3 ou React Flow) → bouton **Export Obsidian** (zip download).

---

## 12. Spécifications écrans

### Layout global
- **Sidebar gauche** (220 px) : logo, nav adaptée rôle, admin en bas
- **Header** (60 px) : toggle rôle gauche, **barre recherche Cmd+K** centre, "+ Nouvelle consultation/appel" droite
- **Main** max-width 1280px, padding 32px

### Dashboard Audioprothésiste (`/`)
**KPIs business** (pas formation) : taux d'appareillage, panier moyen, taux conversion, score consultations.
Sections : bandeau KPIs, évolution taux d'appareillage 4 semaines (line chart), heatmap performance par étape, **encart "Actions recommandées"** (3-4 nudges pré-écrits), table dernières consultations.

Exemples de nudges :
- "Revoir module 7 sur traitement objection prix — vos 3 dernières consultations"
- "1 patient non rappelé depuis 12 j — Mme Lefèvre"
- "Opportunité upsell classe 2 détectée sur M. Martin"

### Dashboard Assistant accueil (`/`)
KPIs adaptés : taux transformation appel→RDV, durée moyenne appels, taux RDV honorés, score qualité accueil. Heatmap framework 5 étapes appel.

### Recherche globale (modal Cmd+K)
Champ focus auto, dès 3+ caractères recherche déclenchée, streaming réponse Claude Haiku en haut, sources cliquables en dessous.

### Page consultation live/replay
Cf. flow 2. WebSocket Deepgram client. Scoring streaming : ré-évaluation toutes les 20 s par Claude Haiku. Insights événementiels.

### Timeline patient
Cf. flow 5. Composant timeline verticale custom (flexbox + absolute positioning, pas de lib lourde).

### Admin Vault
Cf. flow 9. Rendu markdown via `react-markdown` + plugin pour `[[wikilinks]]`.

---

## 13. Prompts IA

**Détaillés dans `docs/prompts.md`** — à charger uniquement quand on implémente les fonctions correspondantes (J6 pour analyse, J8 pour vault et artefacts, J4 pour recherche).

Les 7 prompts à implémenter :
1. Analyse de consultation (Sonnet 4.5)
2. Mise à jour Vault après session (Sonnet 4.5)
3. Recherche knowledge Pilier 1 (Haiku 4.5, streaming)
4. Génération Notes cliniques (Sonnet 4.5)
5. Génération Email patient (Sonnet 4.5)
6. Génération SMS patient (Haiku 4.5)
7. Génération Courrier ORL (Sonnet 4.5)

---

## 14. Audios de démo (TTS ElevenLabs)

### 3 consultations pré-enregistrées (obligatoires J7)
1. **Mme Durand — cas excellent** (~6 min, score 88)
2. **M. Martin — cas moyen** (~5 min, score 65, montée en gamme ratée)
3. **Mme Lefèvre — objection prix non traitée** (~4 min, score 48)

### 2 appels entrants pré-enregistrés (stretch goal J9)
1. **Appel converti** (~2 min, RDV pris, score 82)
2. **Appel perdu** (~2 min, objection prix évitée, prospect raccroche, score 38)

Tous générés via ElevenLabs `eleven_turbo_v2_5`, 2 voix françaises distinctes par audio. Transcriptions pré-alignées en DB pour lecture instant. Cache obligatoire.

---

## 15. Données seed

### Entités fictives
- **5 centres** : Lyon 3, Paris Bastille, Marseille Vieux-Port, Bordeaux Centre, Toulouse Capitole
- **8 audioprothésistes** + **4 assistants accueil** répartis dans les 5 centres
- **2 patients fictifs avec timelines complètes** :
  - **Mme Durand** — parcours réussi (appel → RDV → consult → essai → achat → suivi)
  - **M. Martin** — parcours en cours (appel → RDV → consult, upsell raté, essai en cours)

### Sessions
- **30 consultations** sur 4 semaines, scores réalistes (30% >80, 50% 50-80, 20% <50)
- **15 appels entrants** (stretch) sur 2 semaines

### Vault (Layer B)
- Fiches pré-écrites : 3 audioprothésistes, 2 assistants, 2 centres, 2 patients, 3 patterns
- Pour démo "mémoire qui s'enrichit" : Jonathan lance consult live → à la fin, fiche audioprothésiste s'update en direct (diff visible)

### Knowledge chunks (Layer A)
Ingérés depuis Drive au bootstrap via `pnpm ingest`. 4 programmes, ~400-600 chunks estimés.

Script : `scripts/seed.ts` exécutable via `pnpm seed`.

---

## 16. Découpage des 10 jours

| Jour | Livrable | Done quand |
|---|---|---|
| **J1** | Setup repo + Supabase + schéma DB + env vars | `pnpm dev` tourne, migrations OK |
| **J2** | Layout + design tokens + toggle rôle + routing + pages vides | Nav fluide, 2 personas toggables |
| **J3** | Pipeline ingestion Drive Layer A + admin `/admin/knowledge` | 4 programmes ingérés, retrieval test OK |
| **J4** | Moteur recherche Cmd+K + Catalogue + page programme | Question → réponse IA + sources + ouvrir vidéo timestamp |
| **J5** | Coaching live v1 : micro + Deepgram streaming + UI transcription + framework 10 étapes | Démarrer consult live → transcription défile, scoring se remplit |
| **J6** | Coaching live v2 : analyse Claude streaming + insights + page résultats | À la fin, scores + insights + radar affichés |
| **J7** | Mode replay + génération 3 audios TTS consultation | 3 sessions replay jouables bout en bout |
| **J8 matin** | 4 artefacts post-consultation | Notes + email + SMS + courrier ORL affichés et copiables |
| **J8 aprem** | Layer B vault + update auto après session + page `/admin/vault` | Une session analysée met à jour 3-4 fiches vault |
| **J9 matin** | Timeline patient + dashboard business + nudges | 2 patients fictifs avec timeline complète, dashboard rempli |
| **J9 aprem (stretch)** | Appels entrants replay + framework 5 étapes | Si temps : 2 replays appels jouables |
| **J10** | E2E + répétition Jonathan + export Obsidian + polish | Démo joue bout en bout sans accroc |

**Si retard dès J5-J6** : sacrifier Layer B (J8 aprem) + timeline patient (J9 matin), garder Layer A + coaching consultation comme démo minimum viable.

---

## 17. Scope affirmatif — IN et OUT

### IN
2 personas toggables, Knowledge Platform avec recherche sémantique, coaching consultation live + replay (3 audios TTS), 4 artefacts post-consultation, 10 étapes framework + scoring + insights chiffrés €, Layer B vault Karpathy avec update auto, timeline patient (2 patients fictifs), dashboard business KPIs business, Admin Knowledge + Admin Vault + export Obsidian. **Stretch** : appels entrants replay.

### OUT
Auth + rôles + permissions, app mobile / PWA, multilingue (FR only), intégration logiciel métier (Cosium etc.) — évoquée visuellement, envoi réel emails/SMS, gestion agenda, lint vault automatique, appels entrants **live** (webhook téléphonie) — architecture prête, pas livré, features Beyond autres que teasers visuels, analytics multi-pays.

---

## 18. Points de vigilance technique

- **Latence Deepgram** : < 800 ms parole-écran. Tester dès J5 conditions réelles. Plan B : batch post-enregistrement.
- **Permissions micro** : HTTPS obligatoire. Tester Chrome ET Safari (Mac). Demande propre.
- **Coût IA** : démo 30 min ≈ 3 $. Ne pas re-runner seeds. Cache TTS obligatoire.
- **Ingestion vidéo** : vidéos Drive plusieurs Go. Passer URL Drive directement à Deepgram si possible (vérifier API), sinon streaming download.
- **Volume vault** : démo ~12 fiches. Production scalerait à milliers → roadmap vault v2 avec indexation.
- **Mode live vs replay** : bouton caché "Passer en replay si ça merde" dans page consultation live. Safety net démo.

---

## 19. Conventions de code

- TypeScript strict mode
- Server Components par défaut, Client Components seulement si interactivité
- shadcn/ui pour tous les composants primitifs
- Tailwind uniquement (pas de CSS modules)
- Drizzle ORM pour Supabase
- Server Actions pour mutations, API routes pour streaming uniquement
- Conventional Commits
- 1 fichier = 1 composant, kebab-case fichiers, PascalCase composants
- Pas de commentaires inutiles
- À la fin de chaque journée de travail : écrire un résumé dans `JOURNAL.md` (fait, reste, blockers)

---

## 20. À demander à Jonathan / Raphaël dès J1

1. Comptes API : Anthropic, Deepgram, Voyage, ElevenLabs, Supabase Pro
2. Service Account Google Drive avec lecture sur `Clinic OS JG+RZ/Originaux/`
3. Export PDF des 3 autres Master.key (Personnel accueil, Convaincre téléphone, Audio Vente)
4. **Validation framework "Appel entrant" en 5 étapes (section 9) — critique avant J5**
5. Validation des 3 scénarios TTS consultation + 2 scénarios appels (si stretch)
6. Si possible : 2-3 audios de vraies consultations anonymisées (bien meilleur que TTS pour crédibilité démo)

---

## 21. Structure de la démo (30-35 min)

1. **Intro + dashboard business** (3 min) — "Voici ce qu'Amplifon peut faire bouger"
2. **Pilier 1 — Recherche knowledge** (5 min) — démo Cmd+K, ouverture vidéo au timestamp
3. **Pilier 2A — Consultation live** (10 min) — roleplay avec complice, transcription + scoring + insights direct
4. **Résultats + 4 artefacts** (5 min) — radar, insights chiffrés €, génération livrables
5. **Timeline patient + Karpathy vault** (5 min) — parcours Mme Durand, ouverture Obsidian en parallèle ("transparence, auditabilité, exportabilité")
6. **Pilier 2B — Appels entrants** (3 min) — replay si livré, sinon mock + explication architecture
7. **Retour dashboard** (1 min) — "Consultation live qu'on vient de faire est apparue, KPIs ont bougé"
8. **Roadmap Beyond** (3 min)
9. **Q&A** (5-10 min)

**Points de wow attendus** :
- Recherche langage naturel qui sort un résultat pile poil (J4)
- Transcription qui défile en direct + scoring qui se remplit (J5-J6)
- Insights chiffrés € ("cette objection prix non traitée = 480 €/consult × 10 000 centres = …")
- Ouverture Obsidian sur fiche audioprothésiste qui s'est updatée (J8)
- "La consultation qu'on vient de jouer en live a enrichi la mémoire du réseau — demain elle nourrira le coaching du prochain"

---

## 22. Roadmap post-démo (à mentionner à Amplifon)

1. Auth + rôles (audioprothésiste / manager centre / direction réseau)
2. Multilingue — 26 marchés Amplifon
3. Intégrations téléphonie (Ring Over, Aircall, Avaya, propriétaire Amplifon)
4. Intégration logiciels métier (Cosium, Otoaccess, Noah)
5. App mobile audioprothésiste
6. Lint automatique du vault + détection contradictions
7. Features Beyond (orientation intelligente appels, doc auto en logiciel métier, relance IA, compte-rendu ORL auto, marketing intelligence)
8. Analytics multi-pays + benchmarks anonymisés
9. Programme certifiant (badges, diplômes)

---

**Fin du PRD v2.**
