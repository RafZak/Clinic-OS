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

