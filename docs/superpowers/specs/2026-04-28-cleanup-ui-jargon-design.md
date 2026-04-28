# Spec — Nettoyage UI : retrait du jargon technique

**Date** : 2026-04-28
**Contexte** : MVP en phase de préparation démo Amplifon. Audit du frontend révèle 26 fuites de jargon technique côté UI utilisateur final, dont 16 critiques (visibles en démo). Sources : markdown source brut, vocabulaire d'outil note-taking, vocabulaire RAG/dev, anglais résiduel en mode FR, données brutes (scores, slugs, fichiers, ISO), encarts debug en sidebar.
**Objectif** : livrer une UI cohérente où aucun terme technique, jargon d'outil, chemin de fichier ou donnée brute n'est exposé à l'utilisateur final ou à l'admin. Le produit doit lire comme un produit métier audioprothèse poli, pas comme un outil de note-taking ni un dashboard dev.
**Effort visé** : 1 - 1.5 jour.

---

## Périmètre

### IN

- Refonte du rendu Vault côté utilisateur final (fiche patient, fiche praticien, fiche centre, etc.)
- Modal Cmd+K — reformat des sources affichées
- Page résultats — onglets Coaching et Mémoire
- Sidebar — suppression des encarts "Statut système" et "Dernière analyse"
- Page Mémoire `/admin/vault` — sous-titre, CTA, tableau
- Page Admin Knowledge `/admin/knowledge` — vocabulaire, statuts, KPIs
- Files-table et Retrieval-test (composants admin)
- i18n `messages/fr.json` + `messages/en.json` — audit et réécriture des clés contenant le vocabulaire interdit
- Application des règles dans **les deux locales** (FR et EN — l'app est bilingue via `next-intl`)

### OUT

- **Nettoyage de données seed** : suppression des entrées de tests ("TEST 27Avril", "ZAKINE Raphael") des patients récents — relève des seeds, traité avant la démo dans une passe distincte.
- **Redesign visuel** : typographie, couleurs, espacements, hiérarchie globale. Rien d'esthétique au-delà du contenu.
- **Logique métier / backend** : le statut système reste calculé en interne pour monitoring, seul l'affichage est retiré.
- **Refonte des frameworks de scoring** ou autres logiques produit.
- **Suppression de l'export ZIP du vault** (l'argument "exportable" reste vrai au niveau fonctionnel — seul le mot "Obsidian" disparaît de l'UI).
- **Logique RAG** : pas de changement aux embeddings, scores, retrieval. Uniquement leur exposition côté UI.

---

## Principes (règles d'or)

Ces 5 principes gouvernent toute décision de copy ou d'affichage.

1. **Le markdown source ne fuit jamais en UI.** Aucun `[[wikilink]]` visible avec ses crochets, aucun chemin `.md`, aucune mention "frontmatter YAML". Les fiches Vault se lisent comme des fiches métier avec champs structurés et liens nommés.
2. **Pas de jargon outil/dev visible**, dans aucune locale. Bannis : `Obsidian`, `chunks`, `slug`, `wikilinks`, `backlinks`, `frontmatter`, `ingestion`, `cosine similarity`, `pipeline`, `RAG`, `embedding`, `vector chunks`. Vocabulaire métier audioprothèse partout.
3. **Chaque locale est intégralement cohérente.** En FR : aucun mot anglais résiduel (statuts machine traduits : `success` → `Réussi`, `failed` → `Échec`, etc.). En EN : aucune fuite FR. Pas de mélange.
4. **Pas de données brutes pour l'utilisateur final.** Pas de scores cosinus numériques, pas de noms de fichiers PDF, pas de slugs, pas de timestamps ISO, pas d'UUIDs. Toujours un libellé métier (ex. `Audio Vente · Module 3`).
5. **Sidebar et chrome silencieux quand tout va bien.** Pas d'encart "STATUT SYSTÈME : OK" en permanence. Pas de "DERNIÈRE ANALYSE" volatile. Les patients récents restent (raccourci utile).

---

## Glossaire de remplacement

Vocabulaire à bannir et à substituer dans les deux locales.

| Terme interdit | FR | EN |
|---|---|---|
| `chunks` | `passages` | `passages` |
| `ingestion` (nom/verbe) | `import` / `importer` | `import` / `to import` |
| `Re-ingérer` / `Re-ingest` | `Mettre à jour` | `Refresh` |
| `slug` | (jamais affiché) | (jamais affiché) |
| `wikilinks` / `backlinks` | (jamais affiché) | (jamais affiché) |
| `Liens sortants` / `Liens entrants` | (sections supprimées) | (sections supprimées) |
| `Obsidian` | (jamais affiché) | (jamais affiché) |
| `Frontmatter YAML` | (jamais affiché — champs structurés) | (jamais affiché — structured fields) |
| `success` (statut machine) | `Réussi` | `Success` |
| `failed` | `Échec` | `Failed` |
| `running` | `En cours` | `Running` |
| `partial` | `Partiel` | `Partial` |
| `lost` (statut patient) | `Perdu` | `Lost` |
| `won` (statut patient) | `Gagné` | `Won` |
| `prospect` | `Prospect` | `Prospect` |
| `cosine similarity 0.92` | (masqué partout sauf retrieval test) | (masqué partout sauf retrieval test) |
| `(cible non créée)` | (annotation supprimée) | (annotation supprimée) |
| `path .md` | (jamais affiché) | (jamais affiché) |

---

## Plan d'application par page

### Sidebar — `components/layout/sidebar.tsx`

- **Supprimer** l'encart "STATUT SYSTÈME" (Transcription / IA coach / Mémoire OK).
- **Supprimer** l'encart "DERNIÈRE ANALYSE".
- **Conserver** "PATIENTS RÉCENTS".

### Page Mémoire — `app/admin/vault/page.tsx`

- **Sous-titre** : retirer "exportable Obsidian, auditable" → `"...exportable, auditable."` (clé i18n `vault.subtitle`).
- **CTA** : `Export Obsidian (.zip)` → `Exporter (.zip)` (FR) / `Export (.zip)` (EN). Clé `vault.export`.
- **Tableau colonne droite** : remplacer chemin `.md` par badge type métier (`Audioprothésiste`, `Patient`, `Centre`, `Session`, `Pattern`, etc.).
- **Headers de groupes** : déjà en français ("Audioprothésistes", "Centres", etc.) — vérifier qu'aucun slug n'apparaît en plus.

### Fiche Vault — `app/admin/vault/[...path]/page.tsx` + `components/admin/vault-markdown.tsx`

C'est la page la plus impactée. Refonte du rendu :

- **Header** : retirer la ligne `patients/mme-isabelle-lefevre.md · patient · mis à jour 2026-04-28 06:54`. Garder uniquement le nom + libellé métier court (`Patient · mis à jour le 28 avril 2026`).
- **Section "Frontmatter YAML"** supprimée. Remplacée par un bloc "Métadonnées" / "Details" avec champs structurés métier dont les valeurs sont **résolues** :
  - `Âge : 64 ans`
  - `Statut : Perdu` (et non `lost`)
  - `Centre : Centre Lyon 3` (et non `[[lyon-3]]`) — cliquable vers fiche centre
  - `Audioprothésiste suivi : Dr Jonathan Goldminc` (et non `[[jonathan-goldminc]]`) — cliquable vers fiche praticien
- **Corps markdown** : rendu via `react-markdown` avec composant custom pour les wikilinks `[[slug|alias]]` ou `[[slug]]`.
  - Si la cible existe en base : lien cliquable affichant le **nom métier** (`Centre Lyon 3`, `Dr Jonathan Goldminc`, `Objection prix non traitée`).
  - Si la cible n'existe pas : afficher l'alias humanisé (kebab-case → Title Case français), **sans crochets et sans annotation `(cible non créée)`**.
- **Sections "Liens sortants" et "Liens entrants"** : supprimées de l'UI utilisateur. Les relations sont implicitement présentes via les wikilinks résolus dans le corps.
- **Bouton "Retour à la liste"** : conserver tel quel.

### Fiche patient — `app/patients/[id]/page.tsx`

- **Bloc Mémoire (panneau latéral droit)** : champs `CENTRE` et `AUDIOPROTHÉSISTE SUIVI` doivent afficher le **nom métier résolu** (`Centre Lyon 3`, `Dr Jonathan Goldminc`), pas le wikilink brut. Implémentation : résoudre `[[lyon-3]]` → nom du centre via lookup au moment du rendu.
- **Synthèse parcours** (encart rouge) : rendre le markdown avec wikilinks résolus, mêmes règles que fiche Vault (pas de crochets, alias humanisé en fallback).
- **Lien "Ouvrir la fiche complète"** : conserver, mène à la fiche Vault refondue.

### Modal Cmd+K — `components/layout/search-trigger.tsx`

- **Format des sources** :
  - FR : `Audio Vente · Module 3 — L'accord patient`
  - EN : `Audio Vente · Module 3 — Patient agreement` (titre traduit si dispo, sinon FR + accepter)
  - Si vidéo : ajouter timestamp `· 02:47`.
  - Si PDF livret avec page : ajouter `· p. 12`.
- **Supprimer** : nom de fichier brut (`accord-patient-2024.pdf`), slug du programme (`audio-vente-base`), score de similarité (`0.87`).
- **Implémentation** : résoudre `programSlug` → `programName` côté composant (lookup en base ou via `programs` déjà chargés dans le contexte).

### Page résultats — onglet Coaching — `components/results/results-view.tsx:441-442`

- **Citations sources** : même format que Cmd+K (`Audio Vente · Module 3 — L'accord patient`). Plus de nom de fichier brut, plus de mot "module" en isolé sans titre.

### Page résultats — onglet Mémoire — `components/results/results-view.tsx:603`

- **Liens vers fiches Vault** : afficher un libellé métier (`Profil de Dr Goldminc`, `Mme Durand — patient`, `Centre Lyon 3`), pas le chemin `.md`. Le lien continue de mener à la fiche Vault refondue.

### Admin Knowledge — `app/admin/knowledge/page.tsx`

- **Description page** : retirer "Pipeline d'ingestion Google Drive, chunks vectoriels, test de recherche en direct et historique des runs" → reformuler métier : `"Source de connaissances utilisée par la recherche et le coaching IA. Importée depuis Google Drive."`
- **KPIs** : `chunks` → `passages` ; `ingestion runs` → `imports`.
- **CTA "Re-ingérer"** → `Mettre à jour` (FR) / `Refresh` (EN).
- **Tableau des runs** :
  - Statuts : `success/failed/running/partial` → traduits selon glossaire. Couleur conservée.
  - Timestamps : afficher en français lisible (`28 avril 2026, 14:35`) / EN (`Apr 28, 2026, 2:35 PM`), pas ISO brut.
  - Légende ligne : `12 fichiers · 156 passages` (au lieu de `chunks`).

### Files-table — `components/admin/files-table.tsx`

- **Headers de groupe** : afficher le **nom lisible du programme** (`Audio Vente — Base`), pas le slug (`audio-vente-base`). Lookup nécessaire.
- **Sous chaque fichier** : retirer `drive_folder_path` (chemin Google Drive `/Mon Drive/...`). Si une indication d'origine est utile, libellé court `Importé depuis Drive` sans le path complet.
- **Badges types** : `PDF` / `DOCX` / `Transcription vidéo` — conserver.
- **Compteur passages** : `chunks` → `passages`.

### Retrieval test — `components/admin/retrieval-test.tsx`

- **Disclosure** : envelopper l'outil dans un `<details>` (replié par défaut) ou un toggle, avec libellé `Outil de diagnostic` / `Diagnostic tool`.
- **Contenu interne** : peut conserver scores cosinus et noms de fichiers bruts (vocation debug assumée).
- **Description courte** : `"Outil de diagnostic interne. Affiche les passages les plus proches d'une requête."` (retirer "cosine similarity", "Top 12", "0.92").

### i18n — `messages/fr.json` et `messages/en.json`

Audit ligne par ligne et réécriture des clés contenant les termes interdits du glossaire. Recherche systématique des chaînes : `chunks`, `slug`, `Obsidian`, `wikilink`, `backlink`, `frontmatter`, `ingestion`, `cosine`, `pipeline`, `vector`, `embedding`. Les deux fichiers maintenus en parallèle (cohérence FR/EN).

---

## Critères de validation

Le travail est considéré complet quand :

1. **Grep zéro** sur les pages utilisateur final pour : `[[`, `]]`, `.md` (en tant que texte affiché), `chunks`, `slug`, `Obsidian`, `wikilink`, `backlink`, `frontmatter`, `ingestion`, `cosine`.
2. **Aucune occurrence anglaise** des statuts `success`, `failed`, `running`, `partial`, `lost`, `won`, `pending` dans les rendus FR (en mode locale FR).
3. **Sidebar minimale** : navigation principale + Patients récents + bloc Admin. Rien d'autre dans les zones permanentes.
4. **Fiche Vault test** (Mme Lefèvre et M. Martin) : affiche nom + métadonnées résolues + corps avec wikilinks transformés en liens nommés. Aucun crochet ni chemin `.md` visible.
5. **Modal Cmd+K** : sources sous le format `Programme · Module N — Titre [· timestamp ou page]`. Aucun nom de fichier ni score visible.
6. **Smoke test démo** : ouvrir `/`, `/patients/<id>`, `/admin/vault`, `/admin/vault/<path>`, modal Cmd+K + résultat de recherche, page résultats consultation. Toggle FR ↔ EN. Aucun jargon technique visible dans aucune locale.

---

## Risques et points d'attention

- **Résolution wikilinks** : nécessite un lookup base de données (slug → label). Coût de perf à vérifier sur les pages avec beaucoup de wikilinks (synthèse parcours, fiches Vault). Solution probable : préchargement en SSR avec `vault_pages` indexé.
- **Fallback wikilinks orphelins** : si la cible n'existe pas, l'humanisation kebab-case → Title Case (ex. `objection-prix-non-traitee` → `Objection prix non traitée`) doit gérer correctement les accents et les majuscules. Test à faire sur les patterns du seed.
- **Cohérence prompts IA** : les prompts de mise à jour vault génèrent du markdown avec wikilinks. Le rendu UI nettoie l'affichage mais les fichiers stockés conservent les `[[...]]` bruts (nécessaire pour l'export ZIP). Vérifier que cette dichotomie ne crée pas d'incohérence (ex. génération qui omettrait des wikilinks pensant que l'UI ne les rend pas).
- **i18n charge** : `messages/en.json` et `messages/fr.json` peuvent contenir des dizaines de clés à toucher. Risque de régressions ailleurs. Mitigation : grep ciblé sur les clés modifiées dans les composants consommateurs.

---

## Suite

Une fois ce spec validé, invocation de `superpowers:writing-plans` pour produire le plan d'implémentation détaillé (ordre, fichiers, tests, validations).
