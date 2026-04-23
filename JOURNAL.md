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
