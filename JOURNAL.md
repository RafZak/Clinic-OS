# Journal de bord — Clinic OS

## J1 — 23 avril 2026

### Fait

- **Dépôt git** : initialisé, remote `origin` = `https://github.com/RafZak/Clinic-OS.git`, branche `main`.
- **Next.js 16.2.4** (au lieu de Next 15 du PRD — `create-next-app@latest` fournit la dernière stable, App Router identique, aucune régression) + React 19.2, TypeScript 5, ESLint 9 flat config.
- **Tailwind 4** (nouveau setup PostCSS, CSS-first) + `tw-animate-css` pour les animations.
- **Tokens Amplifon** appliqués dans `app/globals.css` via `@theme inline` : `bg-brand` (`#CC0641`), `bg-brand-dark`, `text-ink`, `bg-surface`, `bg-surface-muted`, `text-text-muted`, `border-border-subtle`. Tokens shadcn mappés par-dessus (`--primary` = brand, `--muted-foreground` = gris texte, etc.).
- **Police Inter** (300-900) via `next/font/google`, `lang="fr"` sur `<html>`.
- **shadcn/ui** initialisé manuellement (le CLI interactif impose "Nova" = Geist, incompatible avec Inter). `components.json` + `lib/utils.ts` écrits à la main. 6 primitives installées : `button`, `card`, `input`, `dialog`, `badge`, `tabs`.
- **Dépendances** : drizzle-orm, postgres (postgres-js), @supabase/supabase-js, @supabase/ssr, @anthropic-ai/sdk, @deepgram/sdk, voyageai, @elevenlabs/elevenlabs-js, lucide-react, react-markdown, remark-gfm, zod, server-only. Dev : drizzle-kit, tsx, dotenv.
- **Schéma Drizzle** (`db/schema.ts`) : 15 tables avec les 3 ajustements validés en Mode A
  1. `patients` enrichi : `status` (`prospect|patient|lost`), `first_contact_at`, `center_id`
  2. `patient_events` : CHECK constraint (phone_call/consultation ⇒ session_id obligatoire)
  3. CHECK constraints sur tous les enums textuels (role, kind, source, status, type, severity, category, speaker, source_type, triggered_by, vault kind)
- **pgvector** activé sur Supabase. Index ivfflat `vector_cosine_ops, lists=100` sur `knowledge_chunks.embedding(1024)`.
- **Migration appliquée** : `drizzle/0000_spotty_roulette.sql` généré puis exécuté sur le projet Supabase `geyyfrqloisqgfmapqjk`. Vérification via `pnpm db:check` : **15/15 tables** présentes dans le schéma `public`, extension `vector` confirmée.
- **Scripts npm** : `dev`, `build`, `start`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:studio`, `db:push`, `db:check`.
- **Connexion Supabase** testée en live : dev server répond HTTP 200 en 1.3 s sur `http://localhost:3000`, `Ready in 220ms`.
- **Commits** : 6 commits Conventional (bootstrap, tokens, deps, schéma, migration, journal).

### Comment lancer et vérifier

```bash
cd /Users/raphaelzakine/Desktop/Clinic-OS
pnpm install                   # si clone frais
pnpm dev                       # http://localhost:3000
pnpm db:check                  # liste les 15 tables + vérifie pgvector
pnpm db:studio                 # UI Drizzle locale sur les tables Supabase
```

### Reste à faire (suite de la roadmap J2+)

- **J2** : layout global (sidebar 220 px + header 60 px + main 1280 px), routing pages vides, toggle rôle audioprothésiste/assistant persisté en cookie, design tokens visibles sur toutes les pages.
- **J3** : ingestion Google Drive (Layer A), chunking PDF/vidéo, embeddings voyage-3-lite, admin `/admin/knowledge`.
- **J4** : recherche Cmd+K (Perplexity-like), catalogue formation 10 cartes, page programme.
- **J5–J6** : coaching consultation live (Deepgram streaming + scoring 10 étapes + insights).
- **J7** : mode replay + génération 3 audios TTS.
- **J8** : 4 artefacts post-consultation + vault Karpathy (Layer B) + admin vault.
- **J9** : timeline patient + dashboard business + appels entrants (stretch).
- **J10** : E2E + répétition + export Obsidian + polish.

### Blockers / points d'attention

- **Clés API IA manquantes** (pas bloquant avant J3) : `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `VOYAGE_API_KEY`, `ELEVENLABS_API_KEY`. À provisionner d'ici lundi prochain.
- **Service Account Google Drive** : aucune credential encore fournie. Nécessaire pour J3. Jonathan / Raphaël doivent créer un service account avec accès lecture sur `Clinic OS JG+RZ/Originaux/`.
- **Framework "Appel entrant"** : les 5 étapes sont posées dans le PRD mais doivent être validées par Jonathan avant J5.
- **Nom du projet local** : le dossier s'appelle `Clinic-OS` (avec majuscule), mais le `package.json` est `clinic-os` (npm interdit les majuscules). Pas de problème fonctionnel, juste une dissymétrie cosmétique.
- **Note Next.js 16 vs PRD Next.js 15** : choix assumé. Next 16 = Next 15 + perf/Turbopack stable, même API App Router. Pas de backporting prévu.
- **Notice ivfflat "little data"** à la création de l'index : normale tant que `knowledge_chunks` est vide, l'index deviendra performant une fois l'ingestion Drive faite (J3).

### Décisions produit / techniques non prévues au PRD

- Ajout du token `--muted-foreground` shadcn mappé sur `#6B7280` (le `--gray` du PRD). Permet d'utiliser les primitives shadcn sans réécriture.
- Utilisation du **Session pooler Supabase** (port 5432) au lieu de la Direct connection (IPv6 only, incompatible avec la majorité des box FR et Vercel).
- Choix de `postgres-js` comme driver Drizzle (préférence pour l'edge, compatible Supabase pooler).

---

## J2 — 23 avril 2026 (suite)

### Fait

- **Rôle persisté en cookie** : `clinic_os_role=audioprothesiste|assistant`, lu via `lib/role.ts::getRole()` (Server Component), écrit via Server Action `app/actions/set-role.ts` avec `revalidatePath("/", "layout")`. Pas d'auth, juste simulation.
- **AppShell** : sidebar 220 px à gauche (logo + nav filtrée par rôle + bloc Admin en bas), header 60 px sticky en haut (toggle rôle + search trigger + CTA nouvelle session), main centré max-w-1280 px-8 py-8. Composant `app/layout.tsx` wrappé.
- **Nav adaptée au rôle** :
  - Commun : Tableau de bord, Patients, Catalogue, Admin Knowledge, Admin Vault
  - Audioprothésiste : Consultations
  - Assistant : Appels entrants
- **Header widgets (client components)** :
  - `RoleToggle` : tabs pastel style iOS, `useTransition` + server action, pas de reload visible
  - `SearchTrigger` : bouton + kbd `⌘K`, shortcut keyboard global (⌘K / Ctrl+K) branché, ouvre un dialog placeholder avec message "Bientôt disponible (J4)"
  - `NewSessionButton` : label adaptatif ("Nouvelle consultation" / "Nouvel appel"), idem placeholder dialog
- **10 pages placeholder** avec `<PageHeader/>` + `<PlaceholderBlock/>` :
  `/`, `/consultations`, `/consultations/[id]`, `/appels`, `/appels/[id]`, `/patients`, `/patients/[id]`, `/catalogue`, `/catalogue/[slug]`, `/admin/knowledge`, `/admin/vault`.
  Le dashboard home affiche 4 cartes KPI adaptées au rôle (valeurs `—` en attendant J9).
- **Tous les routes testés via curl** : 10/10 HTTP 200. Toggle rôle vérifié : le home title et la sidebar changent bien selon le cookie.
- **Bug React 19 rencontré et corrigé** : au 1er build, toutes les pages répondaient HTTP 500 avec `Functions cannot be passed directly to Client Components`. Cause : `NavLink` (Client) recevait `icon: LucideIcon` (une fonction composant) depuis `Sidebar` (Server). Fix : rendu de l'icône côté serveur dans `Sidebar` et passage en `React.ReactNode`. Styling actif/inactif déplacé sur le parent via `[&_svg]:text-brand` Tailwind 4.

### Comment vérifier

```bash
pnpm dev                       # http://localhost:3000
# Cliquer le toggle du header → home title + sidebar changent
# ⌘K (ou Ctrl+K) → dialog recherche placeholder
# Bouton "Nouvelle consultation" → dialog placeholder
```

### Reste à faire (roadmap restante)

- **J3** (prochaine étape) : ingestion Google Drive (Layer A), chunking PDF/vidéo, embeddings voyage-3-lite, admin `/admin/knowledge` fonctionnel avec test de retrieval.
- J4–J10 inchangé par rapport à J1.

### Blockers

- **Identiques à J1** : clés API IA + Service Account Google Drive à provisionner avant J3. Validation framework appel avant J5.

---

## J3 — 23 avril 2026 (suite)

### Fait

- **Google Drive Service Account** : créé (`clinic-os-drive-reader@clinic-os-494219.iam.gserviceaccount.com`), Drive API activée, dossier `Originaux/` partagé en Lecteur, ID récupéré. Credentials en `.env.local`.
- **`scripts/test-drive.ts`** : vérification live de la connexion + arbre de 3 niveaux de profondeur. Inventaire : 147 fichiers (97 PDF + 47 vidéos + 3 DOCX + 4 .key skippés).
- **10 programmes seedés** : 4 actifs (Reference, Personnel accueil, Convaincre téléphone, Audio Vente) + 6 "Bientôt disponible" pour le catalogue J4. Slugs, catégories, icônes lucide, descriptions courtes.
- **Pipeline ingestion complet** livré en `lib/drive/` + `lib/ingest/` + `scripts/ingest.ts` :
  - Authentification JWT Google Service Account
  - Crawler récursif (NFC normalization, skip .DS_Store/.key/affiches, dédup vidéos par name+size, parsing module depuis `SBL_*_module_N` / `[Module N]` / `#N`)
  - Extracteurs : `pdf-parse` v1 (v2 a été réécrite en classe, pas ce qu'on veut), `mammoth` pour DOCX, `@deepgram/sdk` v4 (v5 a réorganisé la namespace et cassé `listen.prerecorded.transcribeFile`) avec `nova-3-general` FR pour les vidéos
  - Chunking : 650 tokens cible / 800 max / 100 overlap par paragraphes→phrases (PDF/DOCX), fenêtres 30 s par paragraphes Deepgram (vidéos)
  - Embeddings : `voyageai` batché à 128 chunks/call, pacing 350 ms, exponential backoff sur 429 (6 retries max)
  - Upsert idempotent : `replaceChunksForFile()` en transaction, keyed sur `drive_file_id`
  - Ingestion_runs tracé avec status + counts + errors jsonb
- **CLI `pnpm ingest`** : flags `--pdfs-only`, `--videos-only`, `--docx-only`, `--program <slug>`, `--limit N`, `--force`. Exposé aussi comme `pnpm seed:programs`, `pnpm db:check`.
- **Admin UI `/admin/knowledge`** : KPIs (chunks par type), breakdown par programme avec barres de progression, 10 derniers runs avec status pills, widget de test de retrieval (useActionState + 4 exemples cliquables).
- **`lib/retrieval/search.ts`** : `semanticSearch()` avec pgvector top-K + collapse near-dup à 0,92 cosine.
- **Ingestion live** : 97 PDFs + 3 DOCX = **100 chunks ingérés**, 0 erreur. Répartition : convaincre-telephone 37, personnel-accueil 25, reference 20, audio-vente 18.
- **Qualité retrieval validée** : 6/7 requêtes d'or sortent le bon document en top-1, similarités 0,44-0,59.

### Décisions / corrections techniques

- **Voyage-3-lite produit 512 dims nativement** (pas de Matryoshka sur la lite). Migration 0001 : `vector(1024)` → `vector(512)`. PRD disait 1024 mais c'était basé sur une mauvaise hypothèse — 512 reste SOTA pour la taille du modèle.
- **ivfflat → HNSW** : avec 100 clusters sur 91 vecteurs, ivfflat probait des clusters vides → 0 résultat sur la plupart des requêtes. HNSW n'a pas ce problème de cold-start. Migration 0002 idempotente.
- **`next.config.ts` `serverExternalPackages`** : ajouté `voyageai`, `googleapis`, `google-auth-library`, `pdf-parse`, `mammoth`, `@deepgram/sdk` — sinon le bundler Next 16 bute sur les imports relatifs cassés du SDK voyageai@0.2.1.
- **Voyage free tier = 3 RPM** (propagation du paiement ~5-10 min). Résolu : l'utilisateur a ajouté sa CB mid-J3, on est repassé sur PAYG à 2000 RPM.

### En attente

- **47 vidéos MP4** pas encore ingérées. Coût Deepgram nova-3 batch ≈ 3 € total, temps estimé ≈ 5-8 h (séquentiel, peut être parallélisé mais Deepgram applique ses propres limits). **À lancer une nuit quand on peut laisser tourner** ou à décider si on veut vraiment toutes les transcrire pour la démo.
- Validation du framework "Appel entrant" avec Jonathan avant J5.
- Clés `ANTHROPIC_API_KEY` (faite), `DEEPGRAM_API_KEY` (faite), `VOYAGE_API_KEY` (faite). `ELEVENLABS_API_KEY` à provisionner avant J7 (génération des 3 audios de démo).

### Reste à faire

- **J4** : page catalogue 10 cartes, page programme, branchement Cmd+K sur le vrai retrieval avec synthèse Claude Haiku streaming.
- J5-J10 inchangé.

### Ce qui est maintenant jouable en démo
- Admin : http://localhost:3000/admin/knowledge — voir les KPIs, tester le retrieval en live.
- Toggle rôle + nav sidebar + pages placeholder.
- Base de connaissance prête pour la recherche J4.

---

## J4 — 23 avril 2026 (suite)

### Fait

- **4 masters Keynote exportés et ingérés en local** (via `pnpm ingest:local`, le user n'ayant pas de droits d'édition sur le Drive partagé) :
  - Master Reference (6,7 Mo) → 424 chunks
  - Mater Personnel Acceuil (5,1 Mo) → 260 chunks
  - Master Audio Vente (4,8 Mo) → 220 chunks
  - Convaincre au téléphone (2,0 Mo) → 120 chunks
- **Volume final** : **1 168 chunks** sur 90 fichiers (avant ajout des vidéos). Reference 452, Personnel accueil 298, Audio Vente 248, Convaincre téléphone 170.
- **Script `pnpm ingest:local <path>`** : pipeline identique à Drive mais pour un fichier local. `drive_file_id = 'local:' + sha1(path|mtime|size)` pour rester idempotent. Métadonnées `origin: 'local-upload'`.
- **Recherche Cmd+K réelle** livrée :
  - `lib/claude.ts` + `lib/retrieval/synthesize.ts` : async generator qui émet `{type:'sources'}` puis `{type:'text', delta}` pour chaque token streamé par Claude Haiku, puis `{type:'done'}`.
  - `app/api/search/route.ts` : POST endpoint qui wrap le generator dans un ReadableStream SSE (`data: {...}\n\n`).
  - `components/layout/search-trigger.tsx` : dialog qui stream la réponse en direct + sources `[N]` cliquables + 4 questions d'exemple.
  - Prompt système français tuné : factuel, 120-250 mots, citations obligatoires, pas de préambule.
- **Catalogue formation** (`/catalogue`) : grille 10 cartes groupées par catégorie (Acquisition / Points de contact / Appareillage / Fidélisation). Compteurs chunks + fichiers live sur les cartes actives. Cartes "Bientôt disponible" en dashed + opacity-60.
- **Page programme** (`/catalogue/[slug]`) : header + badge actif/inactif, 3 stats (fichiers / chunks / vidéos transcrites), puis liste des fichiers groupée par type (PDF / vidéo / DOCX). notFound() si slug inexistant.
- **Ingestion vidéos lancée** en background via Deepgram nova-3-general batch (37 vidéos après dédup). ~8-11 chunks par vidéo de module, tourne encore au moment où ce journal est écrit.

### Performances mesurées

- **Latence Cmd+K** end-to-end : ~300 ms retrieval + 100-200 ms de TTFT Haiku + streaming des ~200-250 mots en ~2-3 s. **Total perçu utilisateur : 3-4 s** du Enter au dernier token.
- **Retrieval top-12 avec dédup** : 250-350 ms contre une base de 1 168 chunks avec HNSW.
- **Exemple de réponse générée** sur "comment demander une recommandation en cabine" : Claude synthétise les 3 moments (identification besoins, bilan auditif, suivi) avec un exemple de script verbatim et 6 sources citées `[1][3][6]` en 220 mots.

### Ce qui marche en démo maintenant

- **Toggle rôle** (header) + sidebar adaptée + pages vides cohérentes.
- **Admin Knowledge** : KPIs, barres par programme, liste des 90 fichiers ingérés, test de retrieval inline.
- **Cmd+K partout** (ou clic sur la barre de recherche dans le header) : question en langage naturel → réponse IA streamée + sources.
- **Catalogue** : 10 programmes, 4 actifs cliquables vers leur page détail, 6 en "Bientôt disponible".
- **Page programme** : breakdown des fichiers ingérés par type.

### Reste à faire

- **J5** : coaching consultation live (micro + Deepgram streaming + scoring 10 étapes). Nécessite validation framework "Appel entrant" avant J5 si on veut le couvrir aussi.
- **J6** : analyse Claude + insights + page résultats.
- **J7-J10** : replay, artefacts, vault, timeline, dashboard, polish.

### Blockers

- Validation framework appel entrant avec Jonathan avant J5.
- Ingestion vidéos finira probablement dans 30-45 min. Pas bloquant pour l'instant (le retrieval marche déjà sur les 1 168 chunks PDF+DOCX).

---

## Fin de journée J4 — 23 avril 2026 tard

### Ajouts de fin de session

- **Ingestion vidéos terminée** : 37 vidéos Deepgram nova-3 FR → 237 chunks de transcription avec timestamps. 0 erreur.
- **Base finale** : **1 405 chunks** — 1152 PDF + 237 vidéo + 16 DOCX. Reference 485, Personnel accueil 377, Audio Vente 326, Convaincre téléphone 217.
- **Recherche externe poussée sur le framework "Appel entrant"** : 7 pages fetched (Walter Learning, Youschool, Keona Health, Phonak Practice Forward, Health Catalyst MI, CitizenCall, CRMA Idf, Hamilton CapTel). Méthodologies confirmées : CRAC, entretien motivationnel, 6 steps consensus côté médical FR + US.
- **Framework v2 écrit dans `lib/frameworks.ts`** — 6 étapes (Accueil, Découverte, Reformulation, Proposition RDV, Traitement objection, Ancrage & Clôture) avec **22 critères scorables** documentés. Différences vs v1 :
  - Reformulation promue en étape dédiée (consensus médical FR)
  - Objection APRÈS proposition RDV (CRAC, CitizenCall)
  - Détection ordonnance/ORL ajoutée (spécificité audio FR)
  - Ancrage séparé de la clôture (senior-specific)
- **Framework "Consultation" aussi enrichi** de critères scorables (30 critères au total sur les 10 étapes) pour préparer l'analyseur IA J6.

### En attente utilisateur / Jonathan

- **Validation du framework appel v2 par Jonathan** — c'est une version solide backed par la littérature mais Jonathan a le dernier mot sur les spécificités du réseau Amplifon. Changement ultérieur = modifier `lib/frameworks.ts` uniquement, le reste du code est découplé.
- **Ingestion `Master Personnel Acceuil` / Audio Vente / Convaincre téléphone** depuis Drive : Jonathan doit upgrade le user en Editor sur le partage Drive, OU l'utilisateur continue de passer par `pnpm ingest:local` (on a 3 masters locaux = 600 chunks supplémentaires déjà ingérés via cette voie).

### Non commencé

- **J5** : coaching consultation live (micro browser + Deepgram WS streaming + UI 3 colonnes + scoring en direct).
- J6, J7, J8, J9, J10 (cf. PRD section 16).

---

## J5 — 24 avril 2026

### Fait

- **Plan écrit** dans `docs/superpowers/plans/2026-04-24-j5-live-coaching.md` puis exécuté en subagent-driven avec review spec + code-quality sur les tâches critiques.
- **Server Actions** (`app/actions/sessions.ts`) : `startLiveSession(kind)` insert + redirect, `finishLiveSession(id, patch)` update vers completed, `abortLiveSession(id)`. Helpers Drizzle dans `lib/sessions.ts`. Review code-quality du 1er commit a remonté 3 issues "Important" (patch-semantics sur `markSessionCompleted`, guard terminal-state, type mismatch) — toutes durcies en un 2e commit avec guards `and(id, status='in_progress')`.
- **Deepgram token endpoint** (`POST /api/deepgram/token`) livré mais **non utilisable** : la clé Admin sur le compte Deepgram revient `"Insufficient permissions"` sur `/v1/auth/grant` malgré le rôle admin UI. Probable feature-gating Deepgram. Endpoint gardé pour rebascule future.
- **Pivot auth browser** : le hook lit `NEXT_PUBLIC_DEEPGRAM_API_KEY` directement et l'injecte comme subprotocol WebSocket `["token", key]`. La clé fuite dans devtools — acceptable pour démo locale sur la machine de Jonathan, à re-hardener en prod.
- **Transcript persistence** (`POST /api/sessions/[id]/transcript`) : zod-validé, batch 1-50 lignes, mapping confidence number→`numeric(4,3)`. Verify curl OK.
- **Audio upload** (`POST /api/sessions/[id]/audio`) + bucket privé Supabase Storage `sessions/` : helper admin service-role, bootstrap idempotent (`pnpm storage:bootstrap`), upsert activé, limite 200 MB. webm (Chrome) et mp4 (Safari) gérés via extension mime-detectée.
- **Hook `useDeepgramLive`** (`hooks/use-deepgram-live.ts`) : `getUserMedia` 16 kHz mono, `MediaRecorder` timeslice 250 ms (webm/opus avec fallback mp4/aac Safari), WebSocket `wss://api.deepgram.com/v1/listen` avec `nova-3-general` FR + `punctuate` + `smart_format` + `interim_results` + `endpointing=300`, batching toutes les 2 s ou tous les 5 finals vers `/transcript`, concat audio chunks pour upload end-of-session.
- **UI 3 colonnes** (`components/live/`) : `LiveTranscript` (timestamps MM:SS + texte, interim italique, auto-scroll, footer "attribution en post-analyse J6"), `LiveFramework` (10/6 étapes du framework `lib/frameworks.ts` avec badge "À évaluer" stub J5), `LiveInsights` (latence en ms + placeholder "IA en veille, livré J6"), `LiveHeader` (timer HH:MM:SS, boutons "Démarrer", "Arrêter et analyser", "Abandonner"), `LiveConsole` orchestrateur (tick 500 ms, stop flow upload→action→`router.refresh`).
- **Routes branchent sur status** : `/consultations/[id]` et `/appels/[id]` fetchent la session, 404 si manquant ou mauvais kind, rendent `LiveConsole` si `in_progress` sinon `ResultsShell` (shell J5 vide, rempli J6-J8).
- **NewSessionButton** transformé en dialog Live/Replay : "Démarrer en direct" invoque la Server Action (redirect interne), "Rejouer une session" disabled avec message J7.

### Testé en Chrome — observations

- **Flow complet bout-en-bout fonctionne** sur une session réelle : session `845bf2ca-8a3e-47c8-9437-f45591965047`, durée 136 s, audio uploadé (`sessions/845bf2ca….webm`, 2 m 16 s), 4 transcript_lines persistées avec confidence 0.93-0.98, statut `completed`, redirect vers `/consultations/[id]` qui rend le ResultsShell.
- **Latence Deepgram** : **400-405 ms** sur les tests successifs — largement sous la cible 800 ms du PRD §18.
- **Qualité transcription FR** : excellente (`nova-3-general` + `smart_format`), ponctuation correcte, accents préservés, quelques coupures mi-phrase liées à `endpointing=300` (Deepgram coupe dès 300 ms de silence ; si on voulait des lignes plus longues il faudrait pousser à 500-700 ms, compromis latence).

### Décision majeure du J5 : **abandon de la diarization live**

Après 3 configurations Deepgram différentes testées en live avec 2 speakers humains distincts, **impossible d'obtenir un label speaker différent de `0`** :
1. `nova-3-general` + `diarize=true` → `speaker: 0` sur toutes les utterances
2. `nova-2-general` + `diarize=true` + `utterances=true` → idem, tout `speaker: 0`
3. `nova-2` + `diarize=true` + `diarize_version=2023-10-04` → champ `speaker` totalement absent

Le live diarization de Deepgram n'est pas fiable dans notre setup (un seul micro laptop, 2 voix proches acoustiquement). Confirmation externe croisée : le projet CoCo a tranché pareil en avril 2026 — ils utilisent CAM++ via ONNX client-side (2-3 jours de dev, 50 MB de modèle, enrollment UX 30-60 s par speaker) ou pyannoteAI en batch pour leur cas.

**Trois pivots envisagés** :
- A. CAM++ client-side : out of scope (2-3 jours)
- B. Heuristique silence-gap (toggle speaker si gap > 1 s entre 2 utterances) : implémentée puis désactivée — gap typique en stream time < 500 ms à cause d'`endpointing=300`, trop instable
- C. **Retenu** : live view sans labels speaker, vraie attribution différée à J6 via **Deepgram batch prerecorded** (pipeline déjà éprouvé sur les 37 vidéos ingérées en J3, diarization batch >> live)

Le hook continue de calculer un speaker via l'heuristique silence-gap et le persiste en DB (schéma exige un enum `practitioner|patient`), mais l'UI ne l'affiche pas. Le footer de la colonne transcription indique honnêtement "L'attribution des voix sera faite en post-analyse (J6, diarization batch Deepgram)".

### Reste à faire

- **J6** : analyseur Claude streaming (scoring par étape ré-évalué toutes les 20 s, insights événementiels chiffrés €, citations Layer A) + **re-transcription batch Deepgram** de l'audio uploadé pour réécrire `transcript_lines.speaker` avec de la vraie diarization. Page résultats réelle — radar, insights triés, transcription attribuée + annotée.
- **J7** : 3 audios TTS ElevenLabs + mode replay.
- J8-J10 inchangé.

### Blockers / points d'attention

- **Clé Deepgram `NEXT_PUBLIC_DEEPGRAM_API_KEY` exposée au browser** — dette de sécurité acceptée pour la démo. À remplacer par `/api/deepgram/token` dès que Deepgram débloque le grant endpoint sur le compte.
- **Safari pas testé** — à faire si on veut assurer le bouton "Nouvelle consultation" sur Safari. Le code prévoit le fallback webm→mp4 mais n'a pas été vérifié en conditions réelles.
- **Framework appel entrant v2** toujours non validé par Jonathan — n'impacte pas J5 puisqu'on utilise le framework tel quel ; un changement ultérieur = modifier `lib/frameworks.ts` seulement.
- **Abort flow** : le bouton "Abandonner" passe `sessions.status='aborted'` mais ne supprime ni l'audio uploadé ni les transcript_lines déjà insérées. Nettoyage à prévoir en admin roadmap.

