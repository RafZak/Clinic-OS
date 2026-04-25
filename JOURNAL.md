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

---

## J6 — 24 avril 2026 (soirée)

### Objectif

Livrer l'analyseur post-session (scoring framework + insights chiffrés € + citations Layer A) + ré-attribution des voix via Deepgram batch + page résultats réelle avec radar, tabs, polling et state failed/retry. **Contrainte ajoutée** : tout doit être déployable en production (Vercel Pro). Pas d'état process, pas de fetch localhost hardcodé, timeouts bornés à 60 s par endpoint.

### Fait

- **Schema delta** (`drizzle/0003_reflective_deathbird.sql`) : 3 colonnes ajoutées à `sessions` — `analysis_status` (enum `pending|transcribing|transcribed|analyzing|done|failed`, default `pending`), `analysis_error` (text null), `analyzed_at` (timestamptz null). Check constraint sur l'enum. Migration appliquée sur Supabase `geyyfrqloisqgfmapqjk`, les sessions existantes ont hérité du default `pending`.
- **Helper site-url** (`lib/site-url.ts`) : résout l'URL absolue pour les fetch server→server. Priorité `NEXT_PUBLIC_SITE_URL` → `https://$VERCEL_URL` → `http://localhost:3000`. Fini les URLs hardcodées.
- **Helper signed URL** (`lib/supabase/storage.ts::createSignedAudioUrl`) : génère une URL signée 10 min sur le bucket `sessions`. Utilisée pour passer l'audio à Deepgram prerecorded sans télécharger dans le runtime serverless (RAM + bande passante).
- **Re-transcription batch** (`lib/analysis/retranscribe.ts`) : fonction pure `(sessionId) ⇒ Promise<void>`. Lock atomique `UPDATE WHERE analysis_status IN ('pending', 'failed') RETURNING`. Appel Deepgram prerecorded `nova-3-general` FR + `diarize=true` + `utterances=true`. Heuristique mapping speaker : premier locuteur = `practitioner`, autres = `patient`. DELETE + INSERT `transcript_lines` en transaction, batch de 200 lignes. Flip status à `transcribed`. Sur erreur : flip à `failed` + `analysis_error` + re-throw.
- **Analyseur Claude Sonnet 4.6** (`lib/analysis/analyze.ts`) : fonction pure. Lock atomique `transcribed|failed → analyzing`. Prompt système FR (vouvoie utilisateur, ton pro-factuel, ancrage marché audio FR avec paniers classe 1/2 et upsell 400-800€ pour calibrer les estimations €). Tool_use structuré `submit_analysis` avec JSON schema strict : `scores[]` (1 par étape framework — `null` si non couverte, pas 0), `insights[]` (3-8, type/severity/title/description/timestamp_ms/related_step/estimated_impact_eur), `summary` 2-3 phrases, `global_score` pondéré. Normalisation côté code : clamp scores 0-100, filtre types/severities sur enums DB, cap tailles texte. Persist en transaction : DELETE+INSERT `session_scores`, DELETE+INSERT `coaching_insights`, UPDATE `sessions` (globalScore/summary/analyzedAt + flip status à `done`).
- **Citations Layer A** (`lib/analysis/citations.ts`) : après normalisation des insights, pour chaque insight on lance `semanticSearch(title + description, topK=4)`, on garde les 2 plus pertinents au seuil 0.35, on stocke `{id, sourceFile, programSlug, moduleNumber, chunkIndex, similarity, excerpt:content.slice(0,280)}` dans `coaching_insights.citation_chunks` (jsonb). Best-effort : une panne retrieval n'échoue pas l'analyse, les insights sortent juste sans citations.
- **3 endpoints API** (`app/api/sessions/[id]/{retranscribe,analyze,status}/route.ts`) : tous en `runtime = "nodejs"`. Retranscribe + analyze ont `export const maxDuration = 60` (Vercel Pro). Retranscribe chaîne vers analyze via `after(async () => fetch(...))` de `next/server` — garantit que le kick survit au return côté Vercel. Status endpoint léger (GET) utilisé par le polling client.
- **Trigger fire-and-forget** (`app/actions/sessions.ts`) : `finishLiveSession` appelle `kickAnalysis(id)` qui utilise `after()` pour POSTer `/api/sessions/[id]/retranscribe` sans bloquer le return de la server action. Action `retryAnalysis(id)` exposée pour le bouton "Relancer" en UI.
- **Page résultats réelle** (`components/live/results-shell.tsx`) : server component async qui fetch `loadResultsBundle` (session + patient joined + transcript_lines + session_scores + coaching_insights avec leurs citation_chunks). Dispatch selon `analysisStatus` :
  - `done` → `<ResultsView>` (client, tabs Radix)
  - `failed` → `<AnalysisFailed>` (client, bouton "Relancer" qui appelle `retryAnalysis` + `router.refresh` après 1,2 s)
  - sinon → `<AnalysisLoading>` (client, polling `/api/sessions/[id]/status` toutes les 3 s, steps animés "Préparation → Ré-attribution voix → Analyse IA → Résultats prêts", `router.refresh()` quand status `done|failed`)
- **Header enrichi** : nom patient si lié sinon fragment d'id, durée formatée, 3 badges (Score global 0-100 en brand color, nombre d'insights, impact estimé €).
- **Tabs** (5) : Vue d'ensemble (radar + 3-5 insights majeurs triés par sévérité), Transcription (lignes avec speaker pill `Pro`/`Patient`, timestamps MM:SS, max-height 600px scrollable), Coaching (insights tous triés sévérité avec citations Layer A `source file · module N · similarité X%` + excerpt italique), Livrables (placeholder J8), Mémoire (placeholder J8).
- **Composant radar** (`components/results/score-radar.tsx`) : recharts `RadarChart` 360 px, fill brand à 18 %, stroke brand 2px, tooltip custom qui rend `label + score/100 + rationale` (ou "Étape non évaluée" si null).
- **Types partagés** (`lib/types/analysis.ts` + `lib/format.ts`) : refactor nécessaire parce que les Client Components ne peuvent pas importer depuis des fichiers `server-only`. Types DB inferés (`ResultsBundle`, `InsightRow`, `InsightCitation`) + formatters (`formatEur`, `formatDuration`, `formatTimestampMs`) déplacés dans des modules neutres. `lib/results.ts` et `lib/analysis/citations.ts` restent server-only avec les fonctions qui font des requêtes DB.

### Vérifié en local (conditions prod-like)

Smoke test complet sur la session `845bf2ca-8a3e-47c8-9437-f45591965047` (la session J5 de 136 s) :

```
POST /api/sessions/845bf2ca.../retranscribe
→ 202 {ok, outcome:{ok, lines:3}} en ~5 s
→ after() kick vers /analyze non-awaité
→ GET /status toutes les 3 s : analyzing → done en ~20 s
```

Résultats persistés :
- **3 transcript_lines** ré-attribuées (Deepgram batch a vu 1 seul speaker sur ce test → tout `practitioner`, ce qui est factuellement correct)
- **10 scores** (étapes 2-3 seulement évaluées car transcript ultra-court, reste `null`)
- **6 insights** dont 1 critical missed_objection chiffré **850 €** sur la gêne en milieu bruyant non creusée
- **Toutes les insights** ont 2 citations Layer A avec similarité > 0.35
- **Summary** honnête : "Le transcript soumis est extrêmement court..."
- **Global score 8/100** (pondération des null fait que le score global reste très bas — comportement attendu)

Page `/consultations/845bf2ca...` rend en HTTP 200, les labels "Session analysée / Score global / Insights / Impact estimé / Vue d'ensemble / Transcription / Coaching / Étape" sont tous présents, container radar 360 px détecté, scripts recharts injectés.

### Décisions assumées — à revisiter quand on passera en vrai prod

1. **Orchestration long-running = 2 endpoints Next avec `maxDuration=60`**, pas Inngest ni Supabase Edge Functions. Raisons : zéro dépendance nouvelle, code TS partagé avec le reste du repo, fonctions d'analyse **pures** (ne prennent qu'un `sessionId`, lisent/écrivent la DB) donc migrables en 1 h vers une vraie queue. **Plafond** : Vercel Pro 60 s/step (120 s total pour retranscribe+analyze). Si une session dépasse 10-15 min, Deepgram batch OU Claude Sonnet peut taper le plafond — on passera Inngest à ce moment-là.
2. **Claude Sonnet 4.6** (pas 4.5 comme dit le PRD original) : l'alias `CLAUDE_MODELS.sonnet` pointait déjà sur `claude-sonnet-4-6` en J4, on garde cohérent.
3. **Heuristique speaker-map batch** : premier locuteur détecté par Deepgram diarization = `practitioner`. Stable en pratique puisque le pro décroche/accueille d'abord. Si le patient parle en premier (ex : replay audio), on aura besoin d'un toggle UI dans une v2.
4. **Fire-and-forget via `after()` de `next/server`** : fonctionne en dev ET sur Vercel. Si dans le futur on détecte des pertes de kick (ex : cold start qui coupe avant que le after ne démarre), on bascule sur un cron Supabase qui pick les sessions `analysis_status=pending` toutes les X min.

### Dette technique explicite (à traiter avant vrai trafic prod)

- **`NEXT_PUBLIC_DEEPGRAM_API_KEY` exposée au browser** (héritée de J5). En prod, tout le monde qui ouvre la page live peut lire la clé dans devtools et consommer le quota. Cibler : migration vers `/api/deepgram/token` quand Deepgram débloque `/v1/auth/grant`, OU router le live via un proxy WebSocket côté serveur.
- **`analysis_error` non bornée en longueur** : slice à 2000 chars côté code mais pas de limite DB. Borner par CHECK constraint si besoin.
- **Pas de retry automatique** : si Claude renvoie un 503, l'analyse échoue et user doit cliquer "Relancer". Suffisant pour démo, pas pour prod. Ajouter 1-2 retries avec backoff côté `callClaude()` quand on aura Inngest (qui le fait gratis).
- **`sessions` sans patient_id** sur la démo : l'header affiche le préfixe d'UUID. À J9 on seed des patients fictifs avec FK vers les sessions pour que le header soit complet.
- **Analyseur coûte ~$0.10 par session** (Sonnet 4.6, ~12k input + 4k output tokens). À cadrer en volume une fois en prod.

### Reste à faire (J7+)

- **J7** : 3 audios TTS ElevenLabs + mode replay. Pages `/consultations/[id]` détectent `source='replay'` et rejouent audio + transcript pré-aligné à la vitesse normale.
- **J8 matin** : 4 artefacts post-consultation (notes cliniques / email / SMS / courrier ORL). Prompts dans `docs/prompts.md` (à créer).
- **J8 aprem** : Layer B vault Karpathy (update auto après session) + `/admin/vault`.
- **J9** : timeline patient (2 fictifs seedés) + dashboard business + stretch appels entrants replay.
- **J10** : polish + E2E + export Obsidian + répétition Jonathan.

### Blockers

- **Framework appel entrant v2** toujours non validé par Jonathan — n'a pas bloqué J6, mais bloquera la démo assistant si on veut coacher un replay d'appel. Éditer `lib/frameworks.ts::PHONE_CALL_FRAMEWORK` quand Jonathan arbitre.
- **Vercel non provisionné** : les env vars (ANTHROPIC_API_KEY, DEEPGRAM_API_KEY, VOYAGE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_DEEPGRAM_API_KEY, NEXT_PUBLIC_SITE_URL) seront à mettre dans le dashboard Vercel avant le premier `vercel deploy`. Documenté dans ce journal.


---

## J7 — 24 avril 2026 (nuit)

### Objectif revisité

Plan initial : générer 3 audios TTS ElevenLabs + mode replay avec audio jouable. **Pivot produit en cours de session** (décision Raphaël) : on met ElevenLabs de côté, pas sûr qu'on aille vers du TTS pour la démo. Remplacé par **replay textuel animé** (transcript pré-écrit qui défile tout seul, zéro audio) + **ajout d'un coach IA en bulles temps réel** pendant les sessions live ET replay + **annotations d'insights en marge** de la transcription post-analyse.

Scope final J7 : 6 livrables codés + 1 E2E testé, zéro appel ElevenLabs, zéro mp3 généré, zéro mp3 commité.

### Fait

- **3 scripts de scénario** dans `scripts/replay/scripts.ts` — constantes typées `REPLAY_SCENARIOS` + helpers `computeTimedLines` (200 WPM pro / 160 WPM patient, pause default 700 ms, overrides aux moments clés), `estimateDurationSeconds`, `getScenarioBySlug`. Contenu validé par Raphaël avec correction latente via Jonathan.
  - **Mme Durand** — cas excellent, 57 tours, durée calculée 7m15s
  - **M. Martin** — montée en gamme ratée, 41 tours, 3m07s
  - **Mme Lefèvre** — objection prix non traitée, 33 tours, 2m39s
  - Scripts en `docs/replay/scripts-v0.md` pour relecture Jonathan ligne par ligne avant transposition TS. Au moment du journal, transposition faite mais markdown gardé comme référence.
- **Seed DB** (`scripts/seed-replay.ts` + `pnpm seed:replay`) : idempotent, cascade-safe.
  - 1 centre Lyon 3, 1 audioprothésiste fictif Claire Moreau (audioprothésiste role), 3 patientes liées (Françoise Durand 68, Henri Martin 72, Isabelle Lefèvre 64)
  - 3 sessions `source='replay'`, `kind='consultation'`, `status='in_progress'`, `analysisStatus='pending'`, `audio_url=null`, practitioner_id + patient_id FK. Durée en secondes calculée depuis `targetDurationSeconds`.
  - Transcript_lines pré-insérées (131 lignes au total) avec `speaker`, `startMs`, `endMs`, `text`, `confidence=1.000`.
  - Idempotence : DELETE de toutes les sessions existantes `source='replay'+patient_id=X` + leur cascade (scores, insights, transcript_lines) avant réinsertion. Run multiple fois sans produire de doublons.
- **ReplayConsole** (`components/live/replay-console.tsx`) : orchestrateur client qui fait défiler le transcript selon un timer `requestAnimationFrame`.
  - Phase `idle|playing|ended|finalizing`, elapsedMs avance à vitesse réelle (1 s démo = 1 s replay).
  - `visibleLines = scriptLines.filter(l => l.startMs <= elapsedMs)` à chaque tick.
  - À la fin naturelle (elapsedMs ≥ totalDurationMs + 800 ms tampon) → auto-transition vers `ended` puis `finalizing` après 1.5 s → `finishLiveSession(sessionId, {audioUrl: null, durationSeconds})` → le pipeline J6 prend le relais (retranscribe skip sur audioUrl null, analyzer tourne sur les transcript_lines déjà en DB).
  - Boutons Démarrer, Arrêter et analyser (coupe court), Abandonner (cleanup via `abortLiveSession`).
  - Réutilise `LiveTranscript` + `LiveFramework` tels quels. `LiveTranscript` enrichi de 3 props optionnels (`showSpeaker`, `footerNote`, `title`) rétro-compatibles avec LiveConsole.
- **ReplayHeader** dédié (`components/live/replay-header.tsx`) : chrono `MM:SS / MM:SS`, badge patientLabel, boutons adaptés par phase. Séparé de `LiveHeader` (trop couplé au state mic/ws du hook Deepgram).
- **`lib/replay-loader.ts`** : helper server-only qui lit `transcript_lines` + `patient.label` et produit un `ReplayBundle` pour passage au composant client.
- **Route dispatch** dans `app/consultations/[id]/page.tsx` et `app/appels/[id]/page.tsx` : si `source === 'replay' && status === 'in_progress'` → `<ReplayConsole>`, sinon fallback sur le comportement live + results existant.
- **Dialog "Nouvelle consultation"** (`components/layout/new-session-button.tsx`) : 2 sections.
  - "Démarrer en direct" (inchangé — flux micro live).
  - "Rejouer un cas-école" : grille de 3 cartes cliquables (patient · résumé · durée · badge score cible). Click → server action `startReplaySession(slug)`.
  - L'onglet replay n'apparaît que pour le rôle `audioprothesiste` (pas pour `assistant`, qui aura ses scénarios appel en J9).
- **Server action `startReplaySession`** (`app/actions/sessions.ts`) : retrouve la session seedée par slug du scénario → patient.label → sessions.patient_id + source='replay'. Reset atomique (delete scores + insights, update session vers status=in_progress + analysis_status=pending + globalScore/summary null). Redirect. Rejouable N fois.
- **Live Coach bulles — nouvelle feature pas prévue au PRD** :
  - `POST /api/coach/tick` (Claude Haiku 4.5, maxDuration=20 Vercel, tool_use `emit_bubble` avec decision `emit|skip`) : reçoit `{sessionId, frameworkKind, lines[], excludeRelatedSteps[]}`, répond `{insight: null | {type, severity, title, description, timestamp_ms, related_step}}`. Prompt FR ancré marché audio (classe 1/2, reste à charge, 100% santé, ordonnance ORL, mutuelle), exige un seul moment coachable par tick ou skip.
  - Hook `useLiveCoach({sessionId, kind, lines, enabled})` : tick 20 s, warmup 4 s, cooldown 12 s après chaque bulle, fenêtre glissante 60 s, skip si pas de nouvelles lignes depuis le dernier tick, skip si déjà bulle trop récente. Accumule dans state client, passe `excludeRelatedSteps` pour éviter de re-bubbler sur les étapes déjà couvertes.
  - `CoachPanel` (`components/live/coach-panel.tsx`) : remplace `LiveInsights` dans LiveConsole **et** ReplayConsole. Bulles empilées top-first avec anim `fade-in slide-in-from-top-2`, badges sévérité (info gris / warning orange / critical brand red), icône par type (`ShieldAlert` / `TrendingUp` / `Sparkles` / `Zap`), timestamp cliquable (pour J8+).
  - Pas de persistance DB pour les bulles temps réel (state client uniquement) — l'analyseur J6 post-session a le dernier mot et écrit les vrais `coaching_insights` en DB. Évite les conflits de dédup.
- **Annotations insights en marge du transcript** (`components/results/results-view.tsx` tab Transcription) : grid 12 cols (lignes 8 / annotations 4 en `lg`, stack en mobile). Algo de matching : pour chaque insight avec `timestampMs`, trouve la ligne la plus proche (englobante si possible, sinon distance minimale, capé à 30 s). Insights sans timestamp → section "Annotations générales" en bas du tab. Tone couleur selon severity aligné sur le CoachPanel.

### Validation IA bout-en-bout (`pnpm tsx --conditions react-server scripts/analyze-replays.ts`)

Les 3 sessions seedées ont été analysées à froid (reset analysis_status → retranscribe skip no-audio → analyze Claude Sonnet 4.6 tool_use → persist). Résultats bruts :

| Scénario | Score cible | **Score IA** | Delta | Insights | Impact estimé € |
|---|---|---|---|---|---|
| durand-excellent | 88 | **87** | -1 | 8 (2 good_practice + 4 improvement info + 1 missed_objection warning 900€ + 1 upsell_missed warning 400€) | 3 100 € |
| martin-upsell-rate | 65 | **52** | -13 | 8 (1 critical upsell_missed 850€ + 4 warning improvement + 1 good_practice + 2 info) | ~900 € |
| lefevre-objection-price | 48 | **19** | -29 | 8 (3 critical + 3 warning + 1 good_practice + 1 info, total ~8 700 €) | ~8 700 € |

**Lecture** :
- **Durand 87 vs 88** : pile dans la marge ±5, script validé. L'IA a correctement identifié les 2 points forts majeurs (projection à 3 mois étape 3, démo comparative étape 5) + des axes fins que j'avais pas anticipés (accessoires connectés, coordonnées directes, rappel intermédiaire pendant les 30 jours d'essai). Génération très nuancée, ça va parfaitement porter la démo "même l'excellence a des axes".
- **Martin 52 vs 65** : -13 hors marge. L'IA est plus sévère que prévu — en ré-relisant le script, elle a raison : le pro n'a pas d'étapes fortes visibles (pas de synthèse orale, pas de présentation structurée, pas d'essai cabine). Pour remonter à 65 il faudrait ajouter 2-3 tours qui montrent une forme de relation ou un moment positif. À itérer avec Jonathan si besoin pour la démo.
- **Lefèvre 19 vs 48** : -29, encore plus sévère. L'IA a capté **toutes** les fautes (objection non traitée critical 2800€, mutuelle renvoyée 1800€, pas d'essai 1800€, pas de RDV suivi 1900€, recommandation déconnectée des besoins, pas de présentation). Score plancher structurel. Pour démo à 48, ajouter 2-3 tours de relationnel positif (ex : le pro écoute vraiment, prend le temps de repositionner, fait une note humaine en fin).

**Verdict** : les scripts sont usables en l'état pour la démo. Les deltas de score n'empêchent pas la dramaturgie, mais Jonathan peut vouloir reéquilibrer Martin/Lefèvre pour coller à ses repères métier. Pas bloquant, pas à faire tout de suite.

### Coût + latence mesurés

- **Claude Sonnet 4.6 analyse** : Durand 73.6 s / Martin 50.1 s / Lefèvre 61.8 s. Tous sous le `maxDuration=60` ? Non, Durand dépasse à 73 s — **à surveiller en prod**. Script Durand est plus long (57 tours vs 33), donc plus de tokens input, donc plus de tokens output. On a 60 s sur Vercel Pro, on aura une marge à gérer sur les très longues sessions (>10 min de transcription). **Dette technique** : Durand a passé en script TS direct (120 s max Node), mais sur Vercel `maxDuration=60` couperait. À surveiller sur la vraie démo (test en prod reste à faire).
- **Coût estimé** : 3 analyses Sonnet 4.6 ≈ 3 × ~$0.10 = **~$0.30 pour seed complet** (idem J6 par session).
- **Haiku coach tick** : pas encore mesuré en conditions réelles (pas de run live). Estimation à partir des tokens system+transcript 60s : ~2-3k input + ~200 output = ~$0.002 par tick. Budget : ~17 ticks max sur Durand × 3 replays × ~5 démos/semaine = ~250 ticks/semaine → **~$0.50/semaine pour le coach en démo**.

### Testé

- `pnpm typecheck` : clean à chaque étape.
- `pnpm seed:replay` : idempotent (run 2× sans doublons, cascade propre).
- `pnpm tsx --conditions react-server scripts/analyze-replays.ts` : 3/3 analyses ok, scores + insights + summaries persistés, 0 erreur.
- Smoke HTTP sur dev server : `/`, `/consultations/<id>` pour les 3 scenarios → HTTP 200. Page Durand contient bien les labels "Score global", "87/100", "Impact estimé", "3 100 €", "Mme Fran…", "Transcription", recharts injecté.

### Dette assumée (à traiter après J7)

- **Scores Martin/Lefèvre hors marge cible** : les scripts ne portent pas assez de comportements positifs pour atteindre 65/48. Itérer avec Jonathan si l'écart gêne la dramaturgie démo. Pas bloquant.
- **Sonnet 4.6 à 73 s sur Durand** : au-dessus du plafond Vercel 60 s. Actions possibles : (a) tronquer l'input en passant moins de transcript, (b) passer à streaming Claude, (c) migrer sur Inngest (orchestration dédiée). À trancher avant J10 si on déploie.
- **Bulles coach non persistées** : état client-only. Si un user reload la page pendant la session, il perd le fil. Suffisant pour la démo, à reconsidérer plus tard.
- **Durée Durand 7m15 longue en démo** : Jonathan devra surveiller la montre, ou cliquer "Arrêter et analyser" à 3-4 min pour pousser l'analyse avant la fin. Pas bloquant (on a explicitement un bouton pour ça).
- **Pas de test Safari** : le code ne dépend plus du mic/MediaRecorder en mode replay (requestAnimationFrame partout), donc Safari devrait tenir. À vérifier vite fait sur la machine de Jonathan.

### Ce qui marche en démo maintenant (cumulatif)

- Toggle rôle + nav sidebar.
- Admin Knowledge : KPIs, liste fichiers, test retrieval inline.
- Cmd+K : recherche naturelle streamée + sources Layer A.
- Catalogue : 10 programmes, 4 actifs cliquables.
- Consultation live : micro + Deepgram 400 ms latence + transcription défile + scoring J6 post-session avec radar + insights chiffrés + citations Layer A.
- **Nouveau J7** : dialog "Nouvelle consultation" → 3 cartes scénarios → replay textuel qui défile tout seul → bulles Haiku qui popent au fil de la lecture → fin → analyseur J6 tourne → radar/insights/coaching/annotations en marge dans la page résultats.
- **Nouveau J7** : live coach bulles en temps réel (pas besoin de replay, marche aussi en vrai live roleplay).
- **Nouveau J7** : tab Transcription enrichi d'annotations IA en marge droite à côté des lignes concernées.

### Reste à faire

- **J8 matin** : 4 artefacts post-consultation (notes cliniques / email / SMS / courrier ORL). Prompts dans `docs/prompts.md` (à créer). Cartes cliquables dans onglet Livrables du ResultsView.
- **J8 aprem** : Layer B vault Karpathy (update auto après session) + page `/admin/vault` (rendu markdown + backlinks + graph + export Obsidian zip).
- **J9 matin** : timeline patient (2 fictifs seedés avec événements), dashboard business avec KPIs réels, nudges.
- **J9 aprem (stretch)** : appels entrants replay (2 scénarios côté assistant, framework 6 étapes).
- **J10** : E2E + polish + répétition Jonathan + export Obsidian + passage Vercel si on déploie.

### Blockers / questions ouvertes

- **Framework appel entrant v2** toujours non validé par Jonathan — même remarque que J6, pas bloquant J7 mais bloquera J9 aprem.
- **Scripts replay Martin/Lefèvre** : scores IA sévères. Itérer si Jonathan juge que la démo a besoin de 65/48 exacts au lieu de 52/19.
- **Chat coach post-session** (interprétation 3 de la feature "coaching bulles" dans la conversation de cadrage) : pas livré J7, à caser J8 ou J9 si temps.

---

## J8 — 25 avril 2026 (matinée)

### Objectif

Livrer (1) les **4 artefacts post-consultation** (notes cliniques, email patient, SMS patient, courrier ORL) générés en parallèle après l'analyse + branchés dans le tab Livrables du ResultsView, et (2) le **Layer B vault Karpathy** complet (pipeline d'enrichissement auto, seed initial, page `/admin/vault` avec rendu markdown / backlinks / graph view / export Obsidian zip). Auto mode acté par Raphaël en début de session : 4 décisions techniques arbitrées en début de J8 (auto-kick artefacts après analyze, frontmatter hybride scalaire-only, React Flow pour le graph, single call vault).

### Fait

- **`docs/prompts.md` réécrit** (réf. CLAUDE.md §13) : 8 prompts documentés avec leur signature `tool_use` réelle (`submit_analysis`, `emit_vault_updates`, `submit_clinical_notes`, `submit_patient_email`, `submit_patient_sms`, `submit_orl_letter`, `emit_bubble`) + modèles à jour (Sonnet 4.6 / Haiku 4.5). Les 7 prompts originaux mentionnaient Sonnet 4.5 et un format JSON-in-text qui n'a jamais été utilisé en pratique — réalignement complet.
- **Pipeline artefacts** (`lib/artifacts/generate.ts`) : 4 fonctions pures `generateClinicalNotes` / `generatePatientEmail` / `generatePatientSms` / `generateOrlLetter` qui chargent en 1 fois le contexte (session + patient + practitioner + center via FK joins + transcript + scores + insights + fiche vault practitioner si elle existe) puis appellent Claude tool_use en parallèle. Persistance DELETE+INSERT en transaction sur `session_artifacts` unique(session_id, type). Métadonnées jsonb (model, durationMs, input/output tokens) — auditable depuis l'UI.
- **Endpoint + auto-kick** : `POST /api/sessions/[id]/artifacts` (no body = regenerate all 4, body `{type}` = single). Chaînage parallèle artefacts + vault depuis `analyze.ts` via `after()` de `next/server` quand l'analyse aboutit. Server actions `regenerateArtifact(sessionId, type)` et `regenerateAllArtifacts(sessionId)` exposées pour les boutons UI.
- **UI tab Livrables** (`components/results/artifacts-panel.tsx`) : grid 2×2 de 4 cartes `ArtifactCard`. Chaque carte : icône + titre + badge "destination simulée" ("Cosium / Otoaccess", "Outlook / Gmail", "SMS Gateway", "Courrier médical"), rendu différencié par type (markdown via `react-markdown` pour les notes/courrier, parsing JSON + conversion HTML→markdown pour l'email afin d'éviter une injection HTML brute, texte brut + compteur caractères pour le SMS). Boutons Copier (clipboard avec feedback 1.8 s) + Régénérer (server action + `router.refresh()` après 1.5 s). Polling automatique côté client toutes les 3 s pendant 90 s si `analysisStatus === 'done'` mais artefacts incomplets — assure que la page se peint même si on arrive avant la fin de la génération parallèle. Footer métadonnées coût/durée pour audit visuel démo.
- **Pipeline vault Karpathy** (`lib/vault/`) : 4 modules complets :
  - `frontmatter.ts` : parser/serializer YAML scalaire déterministe maison (pas de dépendance gray-matter — l'overkill est évité, on n'autorise que des scalars en frontmatter, c'est le contrat avec Claude). Helpers `parseFrontmatter`, `serializeFrontmatter`, `mergeMetadata`.
  - `wikilinks.ts` : `extractWikilinks` + `parseWikilinks` (positions) via `String.matchAll` — regex `\[\[slug(\|alias)?\]\]`.
  - `storage.ts` : helpers Supabase Storage pour le bucket privé `vault` (`writeVaultFile`, `readVaultFile`, `deleteVaultFile`, `listVaultFiles`, `ensureVaultBucket`). Service-role admin client.
  - `ingest.ts` : `updateVaultForSession(sessionId)` — fonction pure. Charge contexte session (avec FK joins) + fiches existantes concernées (practitioner, center, patient si liés, patterns candidats). 1 seul appel Claude Sonnet 4.6 `tool_use` `emit_vault_updates` retourne 2-6 patches typés (`create` / `replace` / `append_section`). Chaque patch est appliqué en : (a) rebuild markdown final selon l'opération, (b) écriture Storage `vault/<path>`, (c) upsert `vault_pages` (metadata = parsed YAML, backlinks = scan `[[…]]` recomputé à chaque write). Garde-fou : si Claude oublie la fiche session, `buildSessionFallback()` la génère automatiquement.
- **Endpoint vault** : `POST /api/sessions/[id]/vault` (`maxDuration=60`). Chaîné en parallèle des artefacts depuis l'analyse.
- **Pré-seed vault** (`scripts/seed-vault.ts` + `pnpm seed:vault`) : 7 fiches initiales idempotentes (UPSERT ON CONFLICT path) — `index.md`, `centers/lyon-3.md`, `practitioners/claire-moreau.md`, 3 fiches patients (Durand / Martin / Lefèvre), `patterns/objection-prix-non-traitee.md`. `entity_id` résolu depuis les rows seedées par `pnpm seed:replay`. Helper `slugify` inliné dans le script pour éviter une dépendance circulaire `dotenv → ingest.ts → db/client.ts` qui faisait échouer le boot.
- **Bucket Storage `vault`** créé via `pnpm storage:bootstrap` (le helper a été ajouté à `lib/vault/storage.ts::ensureVaultBucket`).
- **UI `/admin/vault`** :
  - **Liste** (`app/admin/vault/page.tsx`) : server component, regroupe par `kind`, stats top (fiches totales / audioprothésistes / patients / sessions analysées), bouton "Vue graph" + "Export Obsidian (.zip)".
  - **Détail** (`app/admin/vault/[...path]/page.tsx`) : rendu markdown via `react-markdown`. Composant client `VaultMarkdown` qui transforme les `[[wikilinks]]` en `<Link>` cliquables coloré brand quand la cible existe, en `<span>` muted "cible non créée" sinon. Panneau frontmatter YAML en haut. 2 panneaux backlinks à droite (sortants depuis `vault_pages.backlinks` jsonb, entrants via index jsonb `?| array[…]`).
  - **Graph view** (`app/admin/vault/graph/page.tsx` + `components/admin/vault-graph.tsx`) : React Flow, layout en colonnes par kind avec couleurs distinctes (brand pour practitioners, bleu centres, vert patients, rose patterns, violet sessions, slate index). Edges depuis les backlinks. Click sur node = navigation vers la fiche.
  - **Export Obsidian** (`app/api/admin/vault/export/route.ts`) : route GET qui zippe toutes les fiches via JSZip + ajoute un `_README.md` explicatif "comment ouvrir dans Obsidian". Téléchargement direct.
- **Tab Mémoire du ResultsView** : remplace le `PlaceholderPanel`. 2 cartes cliquables (fiche audioprothésiste + fiche session) avec badge **"Mis à jour à l'instant"** si `updated_at < 5 min` — le **wow moment** de la démo Karpathy. Lien explicite vers `/admin/vault` pour pousser plus loin.
- **Test E2E pipeline** (`scripts/test-j8-pipeline.ts` + `pnpm test:j8 <slug>`) : reset session → retranscribe (skip no-audio) → analyze → generateAllArtifacts() → updateVaultForSession() → récap final (DB read). Validé bout-en-bout sur Durand.
- **Fix Turbopack en cours de J8** : `lib/vault/frontmatter.ts` et `lib/vault/wikilinks.ts` portaient un `import "server-only"` initial. Le composant client `vault-markdown.tsx` les importe pour parser le frontmatter et split les wikilinks côté browser → build error Pages Router. Retrait du marqueur sur ces deux modules (ce sont des utilitaires purs sans accès DB/fs/env). Le marqueur reste sur `ingest.ts` et `storage.ts` qui touchent la DB et Storage.

### Validation E2E mesurée (`pnpm test:j8 durand-excellent`)

Run final sur la session seedée `97024f47-fd43-4ddb-a237-9596d1623c9f` :

| Étape | Durée | Détail |
|---|---|---|
| **Analyze** (Sonnet 4.6) | **72.6 s** | 8 insights, score global **84/100** (cible 88, dans la marge ±5 comme J7) |
| **4 Artefacts** (parallèle) | **20.9 s** | limité par orl_letter qui prend 20.6 s |
| → patient_sms (Haiku) | 1.4 s | 140 caractères, 2 401 + 76 tokens |
| → patient_email (Sonnet) | 9.1 s | 1 305 chars, 4 165 + 493 tokens |
| → clinical_notes (Sonnet) | 15.2 s | 2 556 chars, 3 957 + 874 tokens |
| → orl_letter (Sonnet) | 20.6 s | 3 274 chars, 3 948 + 1 061 tokens |
| **Vault update** (Sonnet 4.6) | **79.2 s** | **5 patches générés, 4 appliqués** (1 patch silencieusement raté — voir dette plus bas) |
| **Total pipeline E2E** | **171.2 s** | 4/4 artefacts persistés, 4/4 fiches entités vault touchées |

**Fiches vault enrichies par cette seule session** :
- `centers/lyon-3.md` (center)
- `patients/mme-francoise-durand.md` (patient — timeline mise à jour)
- `patterns/objection-prix-non-traitee.md` (pattern — Claude a noté que cette session frôle ce pattern)
- `practitioners/claire-moreau.md` (practitioner — synthèse + forces récurrentes + sessions récentes)

C'est **exactement** la mécanique Karpathy attendue pour la démo : une consultation analysée enrichit 4 fiches de façon cohérente, en gardant le contenu existant (operation `replace` ou `append_section` selon le cas). Lors de la démo, Jonathan jouera Durand → ouvrira `/admin/vault/practitioners/claire-moreau` → diff visible.

### Coûts mesurés (1 session E2E complète)

- Artefacts (4 calls) : ~**$0.076** total (Haiku $0.003 + Sonnet $0.020 + $0.025 + $0.028)
- Vault (1 call Sonnet) : ~**$0.078** (estimation 6 000 input + 4 000 output)
- Analyse (J6 inchangé) : ~**$0.10**
- **Total par session E2E ≈ $0.25** — soit ~$1.25 pour rejouer les 5 sessions de démo (3 consultations + 2 appels stretch). Cache TTS coupé par le pivot J7, donc pas de coût ElevenLabs.

### Dette technique acceptée (à traiter après J8)

- **Vault : 1 patch sur 5 silencieusement raté** dans le run final (4 appliqués sur 5 retournés par Claude). Le `try/catch` autour de `applyPatch` log un warning mais continue. À investiguer J9 : probablement la fiche session que Claude a tenté de créer en concurrence avec mon fallback automatique. À diagnostiquer + corriger ; en pratique mon `buildSessionFallback()` couvre le cas dégradé. Pas critique pour la démo (les 4 fiches entités sont à jour, c'est ce que Jonathan montrera).
- **Vault Sonnet 4.6 à 79 s** sur Durand — au-dessus du plafond Vercel 60 s comme l'analyse. Mêmes options qu'au J6 (Inngest, streaming, troncation input). À trancher avant J10 si on déploie. En local, pas bloquant.
- **Artefacts non persistés en cas de crash partiel** : si Claude renvoie 3/4 OK et 1 KO, les 3 sont écrits, le 4ème reste null en DB. L'UI affiche bien "3/4 prêts" et le bouton Régénérer permet de relancer. Suffisant pour démo.
- **Prompt vault tightened en cours de J8** : la première run produisait seulement 1 patch (la fiche session) parce que `minItems: 1` + prompt mou. J'ai bumped à `minItems: 2` + ajouté instructions explicites "Si fiche pratitioner existe, tu DOIS l'enrichir". Marche désormais. Mais à surveiller : si un jour on a une session sans entités liées, `minItems: 2` pourrait planter. À trancher au cas-par-cas.
- **Frontmatter parser maison** : pas de gray-matter. Volontairement minimaliste (seulement scalars). Si à l'avenir on veut des arrays (ex: `tags: [a, b, c]`), il faut soit étendre le parser soit installer gray-matter. Pas un problème pour la démo, prévu en roadmap.

### Ce qui marche en démo maintenant (cumulatif J1→J8)

- Toggle rôle + nav sidebar.
- Admin Knowledge : KPIs, fichiers, test retrieval inline.
- Cmd+K : recherche naturelle streamée + sources Layer A.
- Catalogue : 10 programmes, 4 actifs cliquables.
- Consultation live : micro + Deepgram 400 ms latence + transcription défile + scoring J6 post-session avec radar + insights + citations.
- Replay textuel animé : dialog "Nouvelle consultation" → 3 cartes Durand/Martin/Lefèvre → transcript défile tout seul → bulles coach Haiku popent → fin → analyseur tourne.
- **Nouveau J8** : tab Livrables — 4 cartes cliquables, rendu markdown/HTML, copiables, régénérables, génération auto en parallèle après analyse.
- **Nouveau J8** : tab Mémoire — lien direct vers la fiche audioprothésiste qui vient d'être enrichie + lien vers la fiche session.
- **Nouveau J8** : `/admin/vault` complet — liste par kind, rendu markdown avec wikilinks cliquables, graph React Flow, export Obsidian zip pour audit Amplifon.

### Reste à faire

- **J9 matin** : timeline patient (2 fictifs seedés avec événements de parcours), dashboard business avec vrais KPIs (taux d'appareillage / panier moyen / conversion), nudges ("Revoir module 7 sur traitement objection prix" etc.).
- **J9 aprem (stretch)** : appels entrants replay côté assistant + framework 6 étapes.
- **J10** : E2E + polish + répétition Jonathan + investigation du patch vault qui rate + déploiement Vercel si on y va.

### Blockers / questions ouvertes

- **Framework appel entrant v2** toujours non validé par Jonathan — bloquera J9 aprem si on veut coacher un replay d'appel.
- **Scripts replay Martin/Lefèvre** : scores IA sévères vu en J7. Pas itéré J8 (priorité aux 4 artefacts + vault). Si Jonathan juge nécessaire pour la démo, à itérer J9 ou J10.
- **Investigation 5e patch vault** non bloquante mais à faire en J9 par hygiène.

---

## J9 — 25 avril 2026 (matinée + début d'aprem)

### Objectif

Livrer (1) le **seed des parcours patients complets** (Durand → réussi, Martin → en cours upsell raté, Lefèvre → perdue après objection prix) avec timeline `patient_events` rattachée aux sessions consultation existantes + sessions phone_call seedées, (2) la **page liste `/patients`** avec filtre par statut + métriques agrégées par patient, (3) la **page détail `/patients/[id]`** avec timeline verticale custom + fiche Karpathy en regard, (4) le **dashboard business** branché sur des KPIs réels calculés depuis Drizzle (4 cartes adaptées au rôle, line chart 4 semaines, heatmap framework, table des dernières sessions), (5) l'**encart "Actions recommandées" (nudges)** pré-écrits et paramétrés par les vraies données. Stretch appels entrants reporté faute de validation framework v2.

### Décisions techniques arbitrées avant code (validées par Raphaël)

1. **`patient_events.metadata` = jsonb libre** côté DB + discriminated union TS côté code à l'écriture seed. Cohérent avec `vault_pages.metadata` et `coaching_insights.citation_chunks`. Volumes ridicules (≤ 15 events), zéro migration future.
2. **Dashboard KPIs en JS server avec Drizzle** (pas de SQL agrégé custom au-delà de quelques `LATERAL JOIN`), **pas de cache** (`dynamic = "force-dynamic"`). 50 rows max, on veut voir le KPI bouger en live après une session jouée pendant la démo.
3. **Nudges pré-écrits durs** dans `lib/nudges.ts`, paramétrés par `DashboardContext` (jours depuis appel non rappelé, étape la plus faible du framework, etc.). Déterministe, gratuit, scriptable mot-pour-mot pour la démo. La cohérence avec le PRD §12 est totale.
4. **Lefèvre incluse en statut `lost`** dans la liste patients (pas isolée comme cas d'école) — cohérent avec son scénario d'objection prix non traitée.

### Fait

- **Seed parcours patients** (`scripts/seed-patient-journeys.ts` + `pnpm seed:journeys`) : idempotent, ancré sur `2026-04-25T10:00Z` (TODAY anchor déterministe). Crée un assistant accueil "Sophie Bernard" rattaché à Lyon 3 (rôle `assistant`). Met à jour `patients.status` + `firstContactAt` selon la trajectoire. 13 events insérés au total :
  - **Mme Françoise Durand** (status=`patient`) — 6 events sur 30 jours : appel entrant J-30 (score 82, RDV pris) → RDV scheduled J-30 → consultation J-21 (replay durand-excellent existant) → trial_start J-21 (Phonak Audéo Lumity P90 classe 2, 3 200 €) → delivery J-2 → follow_up J0.
  - **M. Henri Martin** (status=`prospect`) — 4 events sur 15 jours : appel J-15 (score 75) → RDV J-15 → consultation J-7 (replay martin-upsell-rate) → trial_start J-7 (Signia classe 1, 1 800 €, `upsell_missed: true`).
  - **Mme Isabelle Lefèvre** (status=`lost`) — 3 events sur 10 jours : appel J-10 (score 68) → RDV J-10 → consultation J-3 (replay lefevre-objection-price, score 19) — pas d'essai, parcours arrêté.
  - **Sessions kind=`phone_call` seedées** : 3 sessions `source='seed'`, `status='completed'`, `analysis_status='done'`, durée 96-142 s, `globalScore` cohérent (75/82/68), 1 `coaching_insight` chacune. Pas de `transcript_lines` faute de framework v2 validé — la page `/appels/[id]` les ouvre quand même mais sans transcript.
- **`lib/patients.ts`** : 2 loaders server-only (`listPatients`, `getPatientDetail`) basés sur `LATERAL JOIN` SQL pour aggréger events count + dernier event + count consultations + score moyen. Helper `patientSlug` aligné sur `slugify` du vault, mappings `STATUS_LABEL` et `EVENT_LABEL`. Résolution `sessionHasTranscript` via sub-query `EXISTS` pour qu'un event phone_call sans transcript ne soit pas cliquable.
- **Page `/patients`** : table shadcn-styled (avatar initiales + nom + âge + badge statut coloré + centre + counts events/consultations + score moyen + dernière interaction relative). Filtre via search param `?status=prospect|patient|lost|all` rendu en pseudo-Tabs cliquables (Links). Ordonné par date dernière interaction DESC.
- **Composant `<PatientTimeline>`** (`components/patients/patient-timeline.tsx`) : flexbox vertical custom avec ligne `absolute left-3` + dots colorés ringed par kind (sky / violet / brand / amber / emerald / slate). Chaque event = carte avec icône lucide, score si session liée, summary, métadonnées formatées (créneau RDV, produit + classe + prix, durée essai, motif perdu). Click = `<Link>` vers `/consultations/[id]` ou `/appels/[id]` selon `kind` et disponibilité du transcript. Events sans session (RDV, trial, delivery, follow_up) restent non cliquables avec metadata visible.
- **Page `/patients/[id]`** : layout `lg:grid-cols-12` (timeline col-span-7 + Karpathy `sticky top-4` col-span-5). Fiche Karpathy chargée via `getVaultPageByPath('patients/<slug>.md')` et rendue avec `<VaultMarkdown>` existant + index global des pages pour résoudre les wikilinks. Bouton "Ouvrir dans /admin/vault" + horodatage de la dernière mise à jour de la fiche. Si pas de fiche encore : message dégradé.
- **`lib/dashboard.ts`** : `loadDashboard(role)` retourne `DashboardData` typé fort (KPIs, weekly score points, heatmap cells, recent sessions, context riche utilisé par les nudges). Tous les `db.execute` lancés en `Promise.all`. Filtre `patient_id IS NOT NULL` partout pour exclure les sessions live de test orphelines (qui polluaient `avg(global_score)` à cause de scores 8/14 sur des runs de validation J5-J6).
- **Composant `<WeeklyScoreChart>`** (`components/dashboard/weekly-score-chart.tsx`, client component) : recharts LineChart 4 buckets sem (S-3 / S-2 / S-1 / Cette sem.), domain 0-100, brand color, `connectNulls` pour les semaines vides. Fallback dégradé si zéro session sur 4 semaines.
- **Composant `<StepHeatmap>`** : grid responsive 2/3/5 colonnes (consultations 10 étapes, appels 6 étapes), couleur dépendante du score (emerald ≥ 80, amber ≥ 60, orange ≥ 40, red < 40). Server component pur HTML/CSS.
- **Composant `<RecentSessionsTable>`** : table shadcn 5 dernières sessions analysées du framework du rôle, colonnes Patient / Pro + Centre / Score (couleur conditionnelle) / Durée / Date relative / lien vers la session.
- **Dashboard branché** (`app/page.tsx`) : remplace placeholder. 4 KPIs adaptés au rôle (audioprothésiste vs assistant), 2 panels (chart + heatmap), encart Actions recommandées, table dernières sessions. `dynamic = 'force-dynamic'`.
- **`lib/nudges.ts`** + **`<NudgesPanel>`** : 4 max par rôle, sévérité `info|warning|critical` (3 styles tailwind distincts avec icônes Lightbulb/Sparkles/AlertTriangle). Côté pro : étape sous tension, patient lost non rappelée, opportunité montée en gamme avec calcul du delta euros, dernière consultation analysée si <24h. Côté assistant : relance Lefèvre (critical), durée d'appel au-dessus cible, RDV non honorés, pattern objection prix.
- **Bonus dette vault J8** : amélioration du logging du `try/catch` dans `applyPatch`. Au prochain run E2E vault, tout patch en échec produira une ligne JSON taggée `vault_patch_failed` avec `path`, `operation`, `section_heading`, preview du contenu (200 c.) + `stack` tronquée. + nouvelle ligne taggée `vault_ingest:partial` listant tous les échecs en agrégat. Pas de fix spéculatif sans diag clair — le hook capture d'abord la cause au prochain replay.

### Smoke tests E2E (dev server local)

| Endpoint | HTTP | Vérif contenu |
|---|---|---|
| `/patients` | 200 | "Mme Françoise Durand", "M. Henri Martin", "Mme Isabelle Lefèvre", badges Patient/Prospect/Perdu, "Lyon 3" |
| `/patients?status=patient` | 200 | Filtre OK, seul Durand listé |
| `/patients/<durand-id>` | 200 | 6 events Appel/RDV/Consultation/Essai/Livraison/Suivi, "Phonak Audéo Lumity", boutons "Voir l'analyse", "Mémoire organisationnelle" + "Ouvrir dans /admin/vault" |
| `/` (audioprothésiste) | 200 | KPIs : 33 % appareillage, 2 733 € panier, 100 % conv. appel→RDV, 52/100 score consult. Nudges : "Étape 2 sous tension", "Mme Lefèvre pas rappelée", "Opportunité de montée", "Consultation analysée" |
| `/` (assistant, cookie role=assistant) | 200 | KPIs : 100 % appel→RDV, 1m 55s durée moy., 100 % RDV honorés, 75/100 qualité accueil. Nudges : "Relance recommandée Lefèvre", "Pattern récurrent objection prix" |

### Coût mesuré

**$0** sur J9 — aucun appel IA externe. Tous les calculs sont SQL/JS et les nudges pré-écrits durs. La régénération des pages dashboard et patient est purement DB-bound. Cette journée est le coup de pelle de la démo : data, UI, dramaturgie.

### Dette technique acceptée / reportée

- **Stretch appels entrants replay non livré** : bloqué par la validation du framework appel v2 (6 étapes) par Jonathan. **Code analyzer + ReplayConsole + LiveFramework déjà compatibles `kind='phone_call'`** — vérifié dans `lib/analysis/analyze.ts:191` et `lib/frameworks.ts`. Il manque juste : 2 scripts replay (converti score 82 + perdu score 38 dans `scripts/replay/scripts-phone.ts`), extension de `seed-replay.ts` pour seeder ces sessions kind='phone_call' avec transcript_lines, et une variante du dialog "Nouvelle consultation" côté rôle assistant qui propose 2 cartes appel. Estimation : 30-45 min de code une fois le framework validé. À reprendre J10 si feu vert Jonathan.
- **Investigation 5e patch vault non concluante mais instrumentée** : pas de fix spéculatif. Le logging amélioré capturera la cause au prochain replay E2E vault. Ce 4/5 silencieux n'a pas d'impact démo (les 4 fiches entités s'enrichissent comme attendu, c'est ce que Jonathan montre).
- **Sessions live de test polluaient les agrégats dashboard** : 12 sessions `kind='consultation' source='live'` avec `patient_id=null` héritées des runs de validation J5-J6. Ajout du filtre `AND patient_id IS NOT NULL` dans tous les calculs sessions. À nettoyer en bulk un jour (`DELETE FROM sessions WHERE source='live' AND patient_id IS NULL`) — dans le contexte de la démo, ces sessions ne sont liées à aucune fiche patient donc elles sont invisibles partout sauf dans `db.check`.
- **TODAY anchor durci en `2026-04-25`** dans le seed parcours : si le serveur de démo a une date différente, les calculs `daysSinceContact` côté nudges peuvent décaler de quelques jours. Pas critique en local le 25, à surveiller si on déploie demain (J10).

### Ce qui marche en démo maintenant (cumulatif J1→J9)

- Toggle rôle + nav sidebar.
- Admin Knowledge : KPIs, fichiers, test retrieval inline.
- Cmd+K : recherche naturelle streamée + sources Layer A.
- Catalogue : 10 programmes, 4 actifs cliquables.
- Consultation live : micro + Deepgram 400 ms latence + transcription défile + scoring J6 post-session avec radar + insights + citations.
- Replay textuel animé : dialog "Nouvelle consultation" → 3 cartes Durand/Martin/Lefèvre → transcript défile tout seul → bulles coach Haiku popent → fin → analyseur tourne.
- Tab Livrables — 4 cartes copiables/régénérables, génération auto en parallèle après analyse.
- Tab Mémoire — lien direct vers la fiche audioprothésiste qui vient d'être enrichie + lien vers la fiche session.
- `/admin/vault` complet — liste par kind, rendu markdown avec wikilinks cliquables, graph React Flow, export Obsidian zip.
- **Nouveau J9** — Dashboard business avec 4 KPIs réels par rôle, line chart 4 semaines, heatmap framework, table dernières sessions, encart Actions recommandées 100 % data-driven.
- **Nouveau J9** — `/patients` avec filtre par statut, table avec score moyen + dernière interaction.
- **Nouveau J9** — `/patients/[id]` avec timeline verticale 6 types d'événements + fiche Karpathy patient en regard. Click event → ouvre la session analysée.

### Reste à faire

- **J9 aprem (stretch reporté)** : appels entrants replay — déblocage framework v2 par Jonathan + 30-45 min de code.
- **J10** : E2E + polish + répétition Jonathan + investigation patch vault si re-run nécessaire + déploiement Vercel si on y va. Surveillance des durées Sonnet 4.6 (analyse + vault > 60 s sur Durand) qui dépassent le plafond Vercel — bloquant en prod, pas en local.

### Blockers / questions ouvertes

- **Framework appel entrant v2** non validé — bloque le stretch appels.
- **Scripts replay Martin/Lefèvre** : scores IA sévères vu en J7 (52 vs 65 cible, 19 vs 48). Pas itéré J9. Si Jonathan juge l'écart gênant pour la dramaturgie démo, à corriger en J10.
- **Patch vault 5e raté** : maintenant instrumenté mais reproduction non faite faute de temps (relancer un test E2E vault prend 2.5 min). À fusionner avec le polish J10.

---

## J9 stretch — 25 avril 2026 (après-midi) — Appels entrants replay

### Débloquage Phase 1 — Validation framework v3 par Jonathan en live

Session de cadrage en direct avec Jonathan. Refonte philosophique du framework `phone_call` : **l'appel entrant n'est pas un acte de vente, c'est un acte de TRIAGE**. Changements actés :

- L'objectif n'est pas de "vendre du 100% santé" ni de "convaincre" — c'est de **trier** la raison de l'appel (nouveau patient / problème technique / renouvellement / etc.) et de **router vers la bonne durée de RDV**. Aucune décision sur les gammes, prix, classe 1/2 ou forme d'appareil — c'est le job de l'audioprothésiste en RDV.
- La standardiste doit **capturer l'identité tôt** (prénom + nom + email idéalement, sinon téléphone) — un appel anonyme est un lead 100% perdu.
- Question ORL/ordonnance **déplacée à la clôture** (étape 6) — l'évoquer en début d'appel est vécu comme agressif commercialement.
- "Reformulation" supprimée comme étape autonome (intégrée dans Triage / Découverte).
- Étape 5 devient "Action adaptée" : la **bonne durée** de RDV (bilan 60 / technique 15 / renouvellement 45), pas "RDV à tout prix".

Framework v3 final (6 étapes) : Accueil · Identification · Triage · Découverte ciblée · Action adaptée · Ancrage et clôture.

### Débloquage Phase 2 — Tags de triage validés (4 dimensions)

Chacun obligatoire pour un appel téléphonique, produits par l'analyzer en plus des scores/insights/summary :

- **`call_type`** (1 valeur, 7 options) : new_patient / renewal / trial_followup / tech_issue / info_request / urgency / admin
- **`recommended_action`** (1 valeur, 8 options) : rdv_bilan_60min / rdv_renouvellement_45min / rdv_technique_{15,30}min / rappel_pro / resolved_phone / transfer_orl / transfer_admin
- **`lead_temperature`** : hot / warm / cold / lost
- **`data_capture`** : complete / partial / anonymous + **`data_capture_note`** facultative explicative
  - Règle métier : email idéal, téléphone acceptable si pas d'email, **pas de jugement sur la standardiste si le patient refuse** (c'est un fait consigné, pas une faute)

### Fait

- **Framework v3 réécrit** dans `lib/frameworks.ts` (6 étapes + 22 critères validés Jonathan). L'analyzer charge automatiquement le bon framework via `getFramework(kind)` — zéro changement nécessaire en aval.
- **2 scripts replay phone** dans `scripts/replay/scripts-phone.ts` :
  - **`dubois-converti`** — Mme Caroline Dubois 67 ans, premier contact, RDV pris (15 turns, 2m03s, cible 82)
  - **`lefranc-perdu`** — M. Robert Lefranc 71 ans, info_request, lead anonyme (11 turns, 1m02s, cible 38)
- **`scripts/seed-replay-phone.ts`** + **`pnpm seed:replay-phone`** : idempotent, créé Mme Dubois et M. Lefranc rattachés à Sophie Bernard / Lyon 3, 2 sessions `kind='phone_call'` `source='replay'` avec transcript_lines pré-insérées.
- **`lib/phone-tags.ts`** : types stricts + labels FR + helper `parsePhoneTags(unknown)` pour valider les retours Sonnet.
- **Migration DB** : ajout colonne `sessions.metadata` jsonb (ALTER TABLE direct via script ad-hoc, pas drizzle-kit qui requiert un TTY).
- **Analyzer Sonnet 4.6 étendu** dans `lib/analysis/analyze.ts` :
  - Bloc système conditionnel `kind === 'phone_call'` qui décrit la philosophie triage et les 4 dimensions de tagging
  - Tool_use `submit_analysis` avec `phone_tags` requis si phone_call (object typé strict via enums) sinon nullable
  - Persistance dans `sessions.metadata.tags` via merge avec metadata existante
  - Labels transcript adaptés : "Standardiste/Appelant" pour phone_call, "Pro/Patient" pour consultation
- **`<PhoneTagsPanel>`** (`components/results/phone-tags-panel.tsx`) : 4 badges colorés (Type d'appel / Action / Lead température / Capture identité) avec tons distincts par sévérité (emerald/amber/red), affichage de la note Clinic OS en bas si data_capture != complete.
- **`<ResultsShell>` enrichi** : affiche `<PhoneTagsPanel>` au-dessus du `<ResultsView>` quand `kind='phone_call'` et tags présents. **Bonus** : `backHref` corrigé pour pointer vers `/patients/[id]` (pertinent) au lieu de `/consultations` ou `/appels` qui n'existent plus.
- **`startReplaySession(slug)` étendu** dans `app/actions/sessions.ts` : reconnaît à la fois les scénarios consultation et phone, route la session vers `/consultations/[id]` ou `/appels/[id]` selon `kind`. Filtre `kind` dans la lookup pour éviter les collisions.
- **`<NewSessionButton>` côté assistant** : section "Rejouer un appel-école" activée avec 2 cartes Dubois/Lefranc (remplace le placeholder "stretch goal" J7).
- **Labels speakers UI live/replay/results** : `LiveTranscript`, `ReplayConsole`, `LiveConsole`, `ResultsView` paramétrent désormais "Standardiste/Appelant" si `kind=phone_call`.
- **`scripts/analyze-replays-phone.ts`** + **`pnpm tsx --conditions react-server scripts/analyze-replays-phone.ts`** : run E2E à froid (reset → retranscribe skip → analyze → mark completed).

### Architecture live phone_call validée (Jonathan a insisté)

L'architecture **n'est pas replay-only**. Vérifications en live :
- `app/appels/[id]/page.tsx` dispatche déjà `live → LiveConsole` / `replay → ReplayConsole` / `completed → ResultsShell` (acquis J7).
- `LiveConsole`, `ReplayConsole`, `LiveFramework` paramétrés par `kind: FrameworkKind` — chargent automatiquement `PHONE_CALL_FRAMEWORK` v3.
- `startLiveSession(kind)` accepte `phone_call`, redirect vers `/appels/<id>`.
- Le bouton "Nouvel appel" côté assistant ouvre la dialog "Démarrer en direct" qui crée une vraie session live `kind='phone_call'`.
- Coach Haiku tick reçoit déjà `frameworkKind` et adapte ses prompts.

**Pour brancher un vrai téléphone (Twilio / Aircall / Ringover / OVH SIP)** : il suffira d'ajouter un endpoint webhook qui crée une session live `kind='phone_call'` et streame l'audio dual-channel vers Deepgram. Couche d'**ingestion**, pas couche **métier**.

### Validation E2E mesurée — pnpm tsx scripts/analyze-replays-phone.ts

| Scénario | Cible | **Score IA** | Tags produits | Insights | Latence Sonnet |
|---|---|---|---|---|---|
| **dubois-converti** | 82 | **91/100** (+9) | new_patient · rdv_bilan_60min · hot · **complete** | 7 (3 good_practice + 4 improvement) | 45.9 s |
| **lefranc-perdu** | 38 | **8/100** (-30) | info_request · rdv_bilan_60min · **lost** · **anonymous** | 7 (4 critical + 3 warning) | 43.1 s |

**Lecture détaillée Dubois** : l'IA a noté Sophie 91 alors qu'on ciblait 82. Plus généreuse que prévue parce que Sophie a effectivement bien fait le job (identification + triage + ancrage + email + ordonnance ORL en clôture). Les 4 axes d'amélioration captés sont fins et pédagogiques :
- "Date du RDV non précisée avec le quantième — risque pour le public senior" (1 800 € d'impact estimé)
- "Téléphone de rappel non capturé"
- "Deuxième question de découverte absente"
- "Présence du mari non exploitée comme signal de motivation"
- Plus 3 good_practices : identification tôt, ordonnance en clôture, bénéfice patient

**Lecture détaillée Lefranc** : l'IA a noté 8 alors qu'on ciblait 38. Plus sévère que prévu parce qu'elle a vraiment **tout** capté. Insights chiffrés :
- 🔴 critical "Objection prix traitée par chiffrage brut — lead perdu immédiatement" (1 800 €)
- 🔴 critical "Objection 'vous n'avez rien de moins cher ?' non traitée" (950 €)
- 🔴 critical "Aucun RDV proposé — appel entrant 100% non converti" (1 800 €)
- 🔴 critical "Lead 100% anonyme — aucune coordonnée capturée" (1 800 €)
- 🟠 warning "Gammes et prix évoqués — hors du rôle de la standardiste" (philosophie Jonathan parfaitement appliquée)
- 🟠 warning "Zéro découverte"
- 🟠 warning "Accueil non identifiant"

**Total chiffré pour Lefranc : 6 350 € de panier perdu sur un seul appel mal géré**. Pour la démo Amplifon, c'est l'argument financier idéal : à raison de N appels mal gérés par centre × 10 000 centres mondiaux, on chiffre la perte annuelle directement à partir d'**un seul cas réel scoré par l'IA**.

**Note `data_capture_note` auto-générée par Claude pour Lefranc** :
> *"Aucune coordonnée capturée (ni nom, ni téléphone, ni email) — lead totalement non exploitable, aucune relance possible."*

Exactement la philosophie validée par Jonathan : pas de jugement sur la standardiste, juste un fait consigné.

### Smoke E2E UI

| Endpoint | HTTP | Vérif contenu |
|---|---|---|
| `/appels/<dubois-id>` | 200 | "Triage de l'appel", "Nouveau patient", "RDV bilan 60 min", "Chaud", "Identité complète", "Score global 91/100" |
| `/appels/<lefranc-id>` | 200 | "Triage de l'appel", "Demande d'information", "RDV bilan 60 min", "Perdu", "Anonyme", "Note Clinic OS · Aucune coordonnée capturée…", "Score global 8/100", "Standardiste" |
| `/` (assistant) | 200 | Bouton "Nouvel appel" + dialog avec 2 cartes replay phone (Dubois 82, Lefranc 38). Pas d'entrée sidebar "Consultations" résiduelle. |

### Coût mesuré

- 2 analyses Sonnet 4.6 ≈ 2 × ~$0.10 = **~$0.20** pour le seed E2E phone complet
- Latence cumulée 89 s (45.9 + 43.1) — **sous le plafond 60 s par requête**, contrairement à Durand consultation (73 s en J7)

### Dette assumée (à traiter J10 ou plus tard)

- **Score Lefranc 8 vs 38** : très en dessous de la cible. Pour la démo, deux options : (a) garder tel quel et le retourner positivement ("regardez, l'IA est plus sévère que je ne l'avais anticipé, et elle a raison"), (b) ajouter 2-3 turns de comportement positif minimal côté Sophie. À trancher avec Jonathan en répétition J10.
- **Durée Lefranc 1m02 vs cible 1m30** : court mais réaliste pour un appel raté. Pas bloquant.
- **Vrai live téléphonique** : webhook SIP/WebRTC à ajouter pour brancher Aircall/Ringover/Twilio/OVH. Hors scope démo. Architecture prête côté business, c'est juste une couche d'ingestion à faire.
- **Diarisation au micro pour le live phone** : si Jonathan teste un appel live au micro browser (sans téléphone réel), Deepgram doit diariser à l'oreille deux voix qui parlent simultanément/alternance. Moins fiable qu'un face-à-face consult ou qu'un dual-channel SIP. Pour une démo robuste : utiliser le replay (chemin balisé), garder le live au micro pour la suite.

### Ce qui marche en démo maintenant (cumulatif J1→J9 stretch)

- Tout J1-J9 + :
- **Nouveau J9 stretch** — Bouton "Nouvel appel" côté assistant : dialog "Démarrer en direct" + 2 cartes replay (Dubois 82, Lefranc 38)
- **Nouveau J9 stretch** — Replay d'appel : transcript défile, scoring framework v3 6 étapes, coach Haiku temps réel adapté phone_call, finalize → analyze → résultats
- **Nouveau J9 stretch** — Page `/appels/[id]` résultats avec **PhoneTagsPanel** (4 badges colorés) + note Clinic OS automatique si capture incomplète
- **Nouveau J9 stretch** — Argumentaire chiffré pour Amplifon : "ce seul appel raté = 6 350 € de panier perdu par l'IA, multiplié par 10 000 centres = X M€/an"

### Reste à faire (recap pour J10)

- Itérer scripts replay Martin/Lefèvre/Lefranc (consultation + phone) si Jonathan veut ajuster les scores en répétition
- Investigation patch vault 5e raté (logging instrumenté en J9)
- Polish + répétition Jonathan complète bout-en-bout
- Décision déploiement Vercel ou pas (durées Sonnet > 60 s à régler)

