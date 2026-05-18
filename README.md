# Clinic OS

Clinic OS est un MVP de demonstration pour presenter a Amplifon une plateforme d'enablement augmentee par IA pour les reseaux d'audioprothese.

L'application n'est pas pensee comme un LMS classique ni comme un simple outil de coaching. Elle sert de couche d'intelligence ambiante autour des interactions qui existent deja dans un centre auditif : appels entrants, consultations, suivi patient, recherche dans les supports de formation et capitalisation des apprentissages terrain.

Objectif business de la demo : montrer comment une amelioration de quelques points sur le taux d'appareillage, le panier moyen ou la conversion appel vers rendez-vous peut se traduire a l'echelle d'un reseau de 10 000 centres.

## Ce que l'application demontre

Clinic OS repose sur deux piliers produit.

**Knowledge Platform**

Un moteur de recherche semantique en langage naturel pour exploiter les contenus de formation. Un collaborateur peut poser une question metier comme "comment traiter une objection prix sur une classe 2 ?" et obtenir une reponse synthetisee, citee, avec les sources issues des livrets, modules et videos de formation.

**AI Copilot**

Un copilote de coaching pour les audioprothesistes et les assistants d'accueil. Il suit les consultations et les appels, transcrit les echanges, score les etapes du framework commercial, detecte les opportunites manquees et genere les livrables post-consultation.

Le dashboard business n'est pas un troisieme pilier : c'est la vitrine executive. Il met en avant les indicateurs qu'un reseau comme Amplifon veut faire progresser : taux d'appareillage, panier moyen, conversion telephonique, score de qualite relationnelle et actions recommandees.

## Personas

L'application simule deux roles, sans authentification reelle.

- **Audioprothesiste** : gere les consultations, consulte ses scores, lance des replays, accede a la knowledge base, aux patients et aux analyses post-session.
- **Assistant accueil** : gere le premier contact patient, les appels entrants, la conversion appel vers rendez-vous et les scripts de reponse aux objections.

Le role est choisi via un toggle dans le header et persiste dans un cookie.

## Parcours de demo cible

La demo doit permettre a Jonathan de derouler un scenario de 30 a 45 minutes :

1. Ouvrir un dashboard deja rempli avec KPIs business.
2. Poser une question dans la recherche globale Cmd+K et obtenir une reponse IA avec sources.
3. Ouvrir une video ou un document source au bon contexte.
4. Lancer une consultation live ou replay avec transcription et scoring.
5. Terminer la session et afficher la page de resultats.
6. Examiner les insights, les citations, le radar de score et les opportunites chiffrees.
7. Generer ou afficher les 4 artefacts post-consultation : notes cliniques, email patient, SMS, courrier ORL.
8. Ouvrir la timeline patient pour visualiser le parcours complet.
9. Montrer le vault markdown type Obsidian, enrichi par les sessions.
10. Revenir au dashboard et montrer comment l'interaction nourrit la memoire du reseau.

Les flows critiques pour une demo credible sont la recherche, la consultation/replay, la page resultats et la timeline patient.

## Architecture fonctionnelle

### Layer A : Formation Knowledge Base

Le Layer A est le RAG classique du produit. Il contient les supports de formation statiques :

- programmes et modules de formation ;
- livrets PDF ;
- documents DOCX ;
- videos transcrites avec timestamps.

Pipeline :

1. Ingestion depuis Google Drive ou depuis fichiers locaux.
2. Extraction texte PDF/DOCX/video.
3. Chunking semantique.
4. Embeddings via Voyage AI.
5. Stockage dans Supabase Postgres avec pgvector.
6. Recherche semantique top-k.
7. Synthese IA avec citations.

Ce layer alimente la recherche Cmd+K et les analyses de coaching.

### Layer B : Organizational Memory

Le Layer B est une memoire dynamique inspiree du pattern LLM Wiki / Karpathy. Apres chaque session analysee, l'application peut enrichir des fiches markdown reliees entre elles :

```text
vault/
+-- index.md
+-- practitioners/
+-- assistants/
+-- centers/
+-- patients/
+-- patterns/
`-- sessions/
```

Chaque fiche contient du front matter, du markdown et des `[[wikilinks]]`. Elle peut etre rendue dans l'admin vault, indexee en base et exportee pour Obsidian.

Ce layer sert a montrer que Clinic OS ne fait pas une analyse isolee : il capitalise les apprentissages du reseau au fil des interactions.

## Stack

- **Frontend** : Next.js App Router, React, TypeScript
- **UI** : Tailwind CSS, shadcn/ui, lucide-react
- **Base de donnees** : Supabase Postgres, pgvector
- **ORM** : Drizzle
- **Storage** : Supabase Storage
- **Transcription** : Deepgram Nova-3
- **LLM** : Anthropic Claude
- **Embeddings** : Voyage AI
- **TTS de demo** : ElevenLabs
- **Deploiement cible** : Vercel

Note : le PRD initial mentionne Next.js 15, mais le projet tourne actuellement sur Next.js 16 avec le meme modele App Router.

## Demarrage local

Prerequis :

- Node.js compatible avec Next.js 16
- pnpm
- un projet Supabase configure avec pgvector
- les variables d'environnement decrites plus bas

Installation :

```bash
pnpm install
```

Lancer l'application :

```bash
pnpm dev
```

Puis ouvrir :

```text
http://localhost:3000
```

Verifier le typage et le lint :

```bash
pnpm typecheck
pnpm lint
```

Verifier la connexion DB :

```bash
pnpm db:check
```

## Variables d'environnement

Creer un fichier `.env.local` avec les valeurs necessaires :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# IA
ANTHROPIC_API_KEY=
DEEPGRAM_API_KEY=
VOYAGE_API_KEY=
ELEVENLABS_API_KEY=

# Google Drive ingestion
GOOGLE_DRIVE_CLIENT_EMAIL=
GOOGLE_DRIVE_PRIVATE_KEY=
GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID=
```

Selon les scripts utilises, certaines cles peuvent etre optionnelles en local. La recherche, l'ingestion, la transcription et les artefacts IA dependent en revanche de ces providers.

## Scripts utiles

```bash
pnpm dev                         # serveur local Next.js
pnpm build                       # build production
pnpm lint                        # ESLint
pnpm typecheck                   # TypeScript strict

pnpm db:generate                 # genere une migration Drizzle
pnpm db:migrate                  # applique les migrations
pnpm db:push                     # pousse le schema via Drizzle Kit
pnpm db:studio                   # ouvre Drizzle Studio
pnpm db:check                    # verifie les tables et extensions attendues

pnpm seed:programs               # seed des programmes de formation
pnpm seed:replay                 # seed des replays consultation
pnpm seed:replay-phone           # seed des replays appels
pnpm seed:journeys               # seed des parcours patients
pnpm seed:vault                  # seed du vault markdown

pnpm ingest                      # ingestion Google Drive
pnpm ingest:local                # ingestion de fichiers locaux
pnpm storage:bootstrap           # preparation des buckets Supabase Storage
```

## Carte du repo

```text
app/                  Routes Next.js, pages, API routes et server actions
components/           Composants UI par domaine : dashboard, live, results, patients, admin
db/                   Client, schema Drizzle et migrations runtime
drizzle/              Migrations SQL generees
lib/                  Logique metier partagee : analyse, retrieval, ingestion, vault, patients
scripts/              Scripts CLI de seed, ingestion, replay, backfill et smoke tests
docs/                 PRD, prompts, schema SQL, specs, assets et documents Amplifon
messages/             Traductions et contenus internationalises
i18n/                 Configuration i18n
```

## Principaux ecrans

- `/` : dashboard adapte au role courant.
- `/catalogue` : catalogue formation.
- `/catalogue/[slug]` : detail d'un programme.
- `/consultations/[id]` : consultation live ou replay.
- `/appels/[id]` : appel entrant replay/analyse.
- `/patients` : liste patients.
- `/patients/[id]` : timeline et memoire patient.
- `/admin/knowledge` : supervision ingestion et test retrieval.
- `/admin/vault` : exploration du vault markdown.
- `/admin/vault/graph` : visualisation graphe des liens.

## Donnees et modele

Le schema principal est dans `db/schema.ts`. Le schema SQL de reference est aussi documente dans `docs/schema.sql`.

Les tables structurantes sont :

- `centers`, `practitioners`, `patients`
- `programs`, `modules`, `livrets`
- `sessions`, `transcript_lines`, `session_scores`
- `coaching_insights`, `session_artifacts`, `patient_events`
- `knowledge_chunks`, `vault_pages`, `ingestion_runs`

Decision importante : `sessions` unifie consultations et appels entrants via un champ `kind`, ce qui permet de reutiliser l'analyse, le replay, la transcription et les resultats.

## Frameworks de scoring

Les frameworks sont centralises dans `lib/frameworks.ts`.

- Consultation : 10 etapes, de la preparation au suivi.
- Appel entrant : framework dedie a l'accueil, la decouverte, la reformulation, la proposition de rendez-vous, le traitement des objections et la cloture.

Chaque etape peut recevoir un score, une justification et des citations issues de la transcription. Une etape non couverte doit rester non scoree plutot que recevoir artificiellement 0.

## Artefacts post-consultation

Apres analyse, Clinic OS peut produire quatre livrables prets a etre copies dans les outils metier :

- notes cliniques ;
- email patient ;
- SMS patient ;
- courrier ORL.

Ces livrables sont generes a partir de la transcription, des scores, des insights, de la fiche patient et de la memoire praticien.

## Documents de reference

- `AGENTS.md` : PRD v2 adapte aux sessions Codex.
- `CLAUDE.md` : PRD v2 historique utilise avec Claude Code.
- `docs/schema.sql` : schema SQL complet.
- `docs/prompts.md` : prompts IA detailles.
- `docs/replay/` : scripts de scenarios de demo.
- `docs/amplifon/` : documents de synthese et architecture d'integration.
- `JOURNAL.md` : journal de bord des journees de travail.

## Conventions

- TypeScript strict.
- Server Components par defaut, Client Components uniquement pour l'interactivite.
- Tailwind pour le styling.
- shadcn/ui pour les primitives.
- Icones via `lucide-react`.
- Drizzle pour l'acces DB.
- Server Actions pour les mutations.
- API routes pour les flux streaming et integrations.
- Commits en Conventional Commits.
- Pas d'auth reelle dans le MVP : le role est simule.

## Positionnement integration Amplifon

Clinic OS est pense pour s'integrer progressivement a la stack Amplifon :

- Salesforce Service Cloud comme source de verite patient.
- Salesforce Marketing Cloud pour confirmations, rappels et follow-up.
- Amplifon 360 / Field Service pour la mobilite.
- NOAH 4 pour la programmation des aides auditives.
- IDM Audio en France pour devis, facturation et stock.

Le positionnement produit est complementaire d'Agentforce : Agentforce optimise l'avant et l'apres rendez-vous, tandis que Clinic OS intervient pendant l'appel et la consultation, la ou la qualite relationnelle et commerciale se joue.

## Etat d'esprit du MVP

Ce repo sert a construire une demo robuste, pas un produit enterprise final. Les arbitrages sont donc assumes :

- robustesse des parcours de demo avant exhaustivite ;
- donnees fictives et replays pour securiser la presentation ;
- integrations reelles simulees visuellement lorsque necessaire ;
- architecture preparee pour la suite, sans sur-ingenierie prematuree.
