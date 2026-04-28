# Cleanup UI : retrait du jargon technique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bannir tout jargon technique (markdown brut, vocabulaire RAG/dev, anglais résiduel, données brutes, Obsidian) de l'UI utilisateur final et admin de Clinic OS, dans les locales FR et EN.

**Architecture:** Modifications ciblées composant par composant + traduction systématique des clés i18n (`messages/fr.json`, `messages/en.json`). Création de helpers utilitaires (`lib/vault/label.ts`, `lib/format/source-citation.ts`) pour centraliser la résolution slug → label métier et le formatage des sources de citation. Enrichissement minimal du backend retrieval pour exposer `programTitle` et `moduleTitle` aux composants UI.

**Tech Stack:** Next.js 15 (App Router), TypeScript, next-intl v3, Drizzle ORM (Postgres), Tailwind, react-markdown.

---

## Vue d'ensemble des fichiers touchés

**Créés :**
- `lib/vault/label.ts` — humanisation des slugs orphelins en label métier
- `lib/format/source-citation.ts` — formatage `Programme · Module N — Titre [· timestamp/page]`

**Modifiés :**
- `components/layout/sidebar.tsx` — supprimer `<SidebarFooter />`
- `components/layout/sidebar-recents.tsx` — supprimer la branche `lastSession`
- `components/admin/vault-markdown.tsx` — wikilinks sans crochets, supprimer FrontmatterPanel
- `app/admin/vault/page.tsx` — badge type au lieu du chemin `.md`
- `app/admin/vault/[...path]/page.tsx` — refonte header + suppression panneaux backlinks
- `components/patients/memory-view.tsx` — résolution wikilinks dans `inlineMeta`
- `lib/retrieval/search.ts` — enrichir `RetrievalResult` avec `programTitle` + `moduleTitle`
- `components/layout/search-trigger.tsx` — reformat sources Cmd+K
- `components/results/results-view.tsx` — citations Coaching + libellés Mémoire
- `app/admin/knowledge/page.tsx` — `StatusPill` traduit, timestamp formaté, KPIs
- `components/admin/files-table.tsx` — header par titre programme, retrait `drive_folder_path`
- `components/admin/retrieval-test.tsx` — disclosure + capitalisation
- `messages/fr.json` + `messages/en.json` — audit + réécriture massive
- `components/layout/sidebar-footer.tsx` — fichier supprimé après tâche 2

---

## Task 1 : Helpers utilitaires + clés i18n

**Files:**
- Create: `lib/vault/label.ts`
- Create: `lib/format/source-citation.ts`
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

- [ ] **Step 1.1 : Créer `lib/vault/label.ts`**

```typescript
const STOPWORDS_FR = new Set(["de", "du", "des", "le", "la", "les", "et", "à", "au", "aux", "un", "une"]);

/**
 * Humanise un slug kebab-case en label lisible métier.
 * Ex: "objection-prix-non-traitee" → "Objection prix non traitée"
 *     "lyon-3" → "Lyon 3"
 *     "jonathan-goldminc" → "Jonathan Goldminc"
 *
 * Note : pour les slugs avec accents perdus (kebab-case ASCII), la
 * restauration des accents est best-effort. Les pages connues en base
 * doivent toujours être préférées (via pageIndex.title).
 */
export function humanizeSlug(slug: string): string {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length === 0) return slug;
  return parts
    .map((p, i) => {
      if (i > 0 && STOPWORDS_FR.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

/**
 * Résout un slug en label affichable. Préfère le titre indexé en base
 * (pageIndex), sinon humanise le slug.
 */
export function resolveSlugLabel(
  slug: string,
  alias: string | null,
  pageIndex: { slug: string; title?: string }[]
): string {
  if (alias) return alias;
  const indexed = pageIndex.find((p) => p.slug === slug);
  if (indexed?.title) return indexed.title;
  return humanizeSlug(slug);
}
```

- [ ] **Step 1.2 : Créer `lib/format/source-citation.ts`**

```typescript
import type { Locale } from "@/lib/locale";

export type SourceCitationInput = {
  programTitle: string | null;
  moduleNumber: number | null;
  moduleTitle: string | null;
  /** Pour vidéos : timestamp en secondes du début du chunk */
  startSeconds?: number | null;
  /** Pour PDF : numéro de page */
  pageNumber?: number | null;
  /** sourceType pour décider si on affiche le timestamp/page */
  sourceType?: string | null;
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Formate une source de citation pour l'UI utilisateur final.
 * Ex: "Audio Vente · Module 3 — L'accord patient · 02:47"
 *     "Personnel accueil · Module 1"
 *     "Audio Vente · Module 3 — L'accord patient · p. 12"
 */
export function formatSourceCitation(
  input: SourceCitationInput,
  locale: Locale = "fr"
): string {
  const parts: string[] = [];

  if (input.programTitle) parts.push(input.programTitle);

  if (input.moduleNumber != null) {
    const moduleLabel = locale === "en" ? `Module ${input.moduleNumber}` : `Module ${input.moduleNumber}`;
    if (input.moduleTitle) {
      parts.push(`${moduleLabel} — ${input.moduleTitle}`);
    } else {
      parts.push(moduleLabel);
    }
  }

  const head = parts.join(" · ");

  // Suffix : timestamp pour vidéo, page pour PDF
  if (input.sourceType === "video_transcript" && input.startSeconds != null) {
    return `${head} · ${formatTimestamp(input.startSeconds)}`;
  }
  if (input.sourceType === "pdf" && input.pageNumber != null) {
    const pageLabel = locale === "en" ? `p. ${input.pageNumber}` : `p. ${input.pageNumber}`;
    return `${head} · ${pageLabel}`;
  }

  return head;
}
```

- [ ] **Step 1.3 : Modifier `messages/fr.json` — clés i18n bannies réécrites**

Modifications **ciblées** dans `messages/fr.json`. Pour chaque clé, remplacer la valeur existante par la nouvelle :

| Clé | Avant | Après |
|---|---|---|
| `vault.description` | `"Le réseau apprend collectivement. Chaque session enrichit automatiquement les fiches concernées — exportable Obsidian, auditable."` | `"Le réseau apprend collectivement. Chaque session enrichit automatiquement les fiches concernées — exportable, auditable."` |
| `vault.exportZip` | `"Export Obsidian (.zip)"` | `"Exporter (.zip)"` |
| `vault.graphDescription` | `"Visualisation des relations entre fiches via les wikilinks. Cliquez sur un nœud pour ouvrir la fiche."` | `"Visualisation des relations entre fiches. Cliquez sur un nœud pour ouvrir la fiche."` |
| `vault.graphFooter` | `"{nodes} fiches · {edges} liens. Layout calculé automatiquement à partir des wikilinks détectés en base."` | `"{nodes} fiches · {edges} liens."` |
| `catalogue.description` | `"... ingérés dans Clinic OS pour servir la recherche Cmd+K et le coaching des consultations."` | `"... importés dans Clinic OS pour alimenter la recherche et le coaching IA."` |
| `catalogue.filesCount` | `"{count, plural, one {# fichier} other {# fichiers}} · {chunks} chunks"` | `"{count, plural, one {# fichier} other {# fichiers}} · {chunks} passages"` |
| `admin.knowledge.description` | `"Source de connaissances injectée dans la recherche Cmd+K et le coaching IA. Pipeline d'ingestion Google Drive, chunks vectoriels, test de recherche en direct et historique des runs."` | `"Source de connaissances utilisée par la recherche et le coaching IA. Importée depuis Google Drive."` |
| `admin.knowledge.kpiTotal` | `"Chunks totaux"` | `"Passages totaux"` |
| `admin.knowledge.slugFiles` | `"slug : {slug} · {count, plural, one {# fichier} other {# fichiers}}"` | `"{count, plural, one {# fichier} other {# fichiers}}"` |
| `admin.knowledge.chunksValue` | `"{count} chunks"` | `"{count} passages"` |
| `admin.knowledge.runsDescription` | `"Déclencher depuis le CLI : "` | `"Mise à jour depuis Google Drive."` |
| `admin.knowledge.runFiles` | `"{files} fichiers · {chunks} chunks"` | `"{files} fichiers · {chunks} passages"` |
| `admin.knowledge.reingest` | `"Re-ingérer"` | `"Mettre à jour"` |
| `admin.knowledge.filesDescription` | `"{count, plural, one {# fichier} other {# fichiers}} distincts en base, dédupliqués par drive_file_id. Ordre stable par programme puis par nom de fichier."` | `"{count, plural, one {# fichier} other {# fichiers}} importés, regroupés par programme."` |
| `admin.knowledge.filesGroupSummary` | `"{files, plural, one {# fichier} other {# fichiers}} · {chunks} chunks"` | `"{files, plural, one {# fichier} other {# fichiers}} · {chunks} passages"` |
| `admin.knowledge.filesEmpty` | `"Aucun fichier en base. Lancer une ingestion avec "` | `"Aucun fichier importé pour l'instant."` |
| `admin.knowledge.fileChunks` | `"{count, plural, one {# chunk} other {# chunks}}"` | `"{count, plural, one {# passage} other {# passages}}"` |
| `admin.knowledge.retrievalTitle` | `"Test de retrieval"` | `"Outil de diagnostic"` |
| `admin.knowledge.retrievalDescription` | `"Soumets une requête en langage naturel. Top 12 chunks par similarité cosinus, puis collapse des doublons à 0.92."` | `"Affiche les passages les plus proches d'une requête. Réservé au diagnostic interne."` |
| `admin.knowledge.retrievalCount` | `"{count, plural, one {# résultat} other {# résultats}} · {ms} ms"` | `"{count, plural, one {# résultat} other {# résultats}} · {ms} ms"` (inchangé) |
| `admin.knowledge.retrievalQueryLabel` | `"query : \"{query}\""` | `"Requête : « {query} »"` |

**Ajouter** ces nouvelles clés (à l'emplacement adéquat) :

Sous `vault` :
```json
"metadataTitle": "Détails",
"kindLabel": {
  "index": "Sommaire",
  "practitioner": "Audioprothésiste",
  "assistant": "Assistant accueil",
  "center": "Centre",
  "patient": "Patient",
  "pattern": "Pattern récurrent",
  "session": "Session"
},
"updatedAtSuffix": "mis à jour le {date}"
```

Sous `admin.knowledge`, ajouter une sous-clé `runStatus` :
```json
"runStatus": {
  "success": "Réussi",
  "failed": "Échec",
  "running": "En cours",
  "partial": "Partiel"
}
```

- [ ] **Step 1.4 : Modifier `messages/en.json` — équivalent EN**

Mêmes clés que step 1.3, traduites en anglais :

| Clé | Après EN |
|---|---|
| `vault.description` | `"The network learns collectively. Every session automatically enriches the related entries — exportable, auditable."` |
| `vault.exportZip` | `"Export (.zip)"` |
| `vault.graphDescription` | `"Visualisation of relations between entries. Click a node to open the entry."` |
| `vault.graphFooter` | `"{nodes} entries · {edges} links."` |
| `catalogue.description` | `"... imported into Clinic OS to power search and AI coaching."` (réécrire toute la chaîne avec ce remplacement final) |
| `catalogue.filesCount` | `"{count, plural, one {# file} other {# files}} · {chunks} passages"` |
| `admin.knowledge.description` | `"Knowledge source used by search and AI coaching. Imported from Google Drive."` |
| `admin.knowledge.kpiTotal` | `"Total passages"` |
| `admin.knowledge.slugFiles` | `"{count, plural, one {# file} other {# files}}"` |
| `admin.knowledge.chunksValue` | `"{count} passages"` |
| `admin.knowledge.runsDescription` | `"Refreshed from Google Drive."` |
| `admin.knowledge.runFiles` | `"{files} files · {chunks} passages"` |
| `admin.knowledge.reingest` | `"Refresh"` |
| `admin.knowledge.filesDescription` | `"{count, plural, one {# file} other {# files}} imported, grouped by program."` |
| `admin.knowledge.filesGroupSummary` | `"{files, plural, one {# file} other {# files}} · {chunks} passages"` |
| `admin.knowledge.filesEmpty` | `"No file imported yet."` |
| `admin.knowledge.fileChunks` | `"{count, plural, one {# passage} other {# passages}}"` |
| `admin.knowledge.retrievalTitle` | `"Diagnostic tool"` |
| `admin.knowledge.retrievalDescription` | `"Shows the passages closest to a query. Internal diagnostic only."` |
| `admin.knowledge.retrievalQueryLabel` | `"Query: « {query} »"` |

**Ajouter** sous `vault` (EN) :
```json
"metadataTitle": "Details",
"kindLabel": {
  "index": "Index",
  "practitioner": "Audiologist",
  "assistant": "Front desk",
  "center": "Center",
  "patient": "Patient",
  "pattern": "Pattern",
  "session": "Session"
},
"updatedAtSuffix": "updated on {date}"
```

Et sous `admin.knowledge` (EN) :
```json
"runStatus": {
  "success": "Success",
  "failed": "Failed",
  "running": "Running",
  "partial": "Partial"
}
```

- [ ] **Step 1.5 : Vérifier la compilation TypeScript**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur. Les nouvelles clés i18n n'apparaissent pas encore dans le code (elles seront utilisées plus tard) — donc aucune régression attendue.

- [ ] **Step 1.6 : Commit**

```bash
git add lib/vault/label.ts lib/format/source-citation.ts messages/fr.json messages/en.json
git commit -m "feat(ui-cleanup): helpers label/source-citation + i18n purge jargon"
```

---

## Task 2 : Sidebar — supprimer encart Statut système

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Delete: `components/layout/sidebar-footer.tsx`

- [ ] **Step 2.1 : Modifier `components/layout/sidebar.tsx` — retirer l'import et le rendu**

Modifier `components/layout/sidebar.tsx` :

Retirer la ligne 14 :
```tsx
import { SidebarFooter } from "./sidebar-footer";
```

Retirer la ligne 105 :
```tsx
      <SidebarFooter />
```

- [ ] **Step 2.2 : Supprimer le fichier `components/layout/sidebar-footer.tsx`**

```bash
rm /Users/raphaelzakine/Desktop/Clinic-OS/components/layout/sidebar-footer.tsx
```

- [ ] **Step 2.3 : Vérifier que les clés i18n `nav.systemStatus`, `nav.transcription`, `nav.aiCoach`, `nav.memorySystem`, `nav.ok`, `nav.down` ne sont plus utilisées ailleurs**

Run: `grep -rn 'systemStatus\|aiCoach\|memorySystem\|"down"\|nav\.ok' /Users/raphaelzakine/Desktop/Clinic-OS/components /Users/raphaelzakine/Desktop/Clinic-OS/app 2>/dev/null`

Expected: aucune occurrence (sauf dans `messages/*.json` à nettoyer).

- [ ] **Step 2.4 : Nettoyer les clés i18n inutilisées**

Modifier `messages/fr.json` et `messages/en.json` : supprimer les clés `nav.systemStatus`, `nav.transcription`, `nav.aiCoach`, `nav.memorySystem`, `nav.down`. Conserver `nav.ok` (utilisé ailleurs probablement, vérifier d'abord avec `grep -rn '"ok"' /Users/raphaelzakine/Desktop/Clinic-OS/components /Users/raphaelzakine/Desktop/Clinic-OS/app | grep -i 'common\|nav'`).

- [ ] **Step 2.5 : Vérifier la compilation et lancer un check rapide**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

Run: `pnpm dev` puis ouvrir `http://localhost:3000/` — vérifier que la sidebar n'affiche plus le bloc "STATUT SYSTÈME". Tuer le serveur après vérification.

- [ ] **Step 2.6 : Commit**

```bash
git add -u components/layout/sidebar.tsx components/layout/sidebar-footer.tsx messages/fr.json messages/en.json
git commit -m "feat(ui-cleanup): retire l'encart Statut système de la sidebar"
```

---

## Task 3 : Sidebar — supprimer encart Dernière analyse

**Files:**
- Modify: `components/layout/sidebar-recents.tsx`

- [ ] **Step 3.1 : Modifier `components/layout/sidebar-recents.tsx` — retirer la branche `lastSession`**

Remplacer entièrement le contenu de `components/layout/sidebar-recents.tsx` par :

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SidebarRecentPatient } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<SidebarRecentPatient["status"], string> = {
  prospect: "bg-slate-400",
  patient: "bg-emerald-500",
  lost: "bg-red-500",
};

function initials(label: string): string {
  const parts = label.replace(/^(M\.|Mme|Mlle)\s+/i, "").split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export async function SidebarRecents({
  patients,
}: {
  patients: SidebarRecentPatient[];
  /** lastSession est conservé en arg pour ne pas casser l'appelant, mais ignoré. */
  lastSession?: unknown;
}) {
  if (patients.length === 0) return null;

  const tNav = await getTranslations("nav");

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {tNav("patientsRecent")}
        </p>
        <ul className="flex flex-col gap-0.5">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/patients/${p.id}`}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-muted-foreground">
                  {initials(p.label)}
                  <span
                    className={cn(
                      "absolute -bottom-0 -right-0 size-2 rounded-full ring-2 ring-surface",
                      STATUS_DOT[p.status]
                    )}
                    aria-hidden
                  />
                </span>
                <span className="truncate">{p.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

Note : la prop `lastSession` reste optionnelle mais ignorée. Le call-site dans `sidebar.tsx` (ligne 78-81) continue de fonctionner sans modification.

- [ ] **Step 3.2 : Nettoyer la clé i18n `nav.lastAnalysis`**

Si plus d'occurrences : `grep -rn 'lastAnalysis' /Users/raphaelzakine/Desktop/Clinic-OS/components /Users/raphaelzakine/Desktop/Clinic-OS/app` → supprimer la clé `nav.lastAnalysis` de `messages/fr.json` et `messages/en.json`.

- [ ] **Step 3.3 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3.4 : Vérification visuelle**

Run: `pnpm dev` puis ouvrir `/` — vérifier que la sidebar n'affiche plus "DERNIÈRE ANALYSE" mais conserve "PATIENTS RÉCENTS". Tuer le serveur après.

- [ ] **Step 3.5 : Commit**

```bash
git add -u components/layout/sidebar-recents.tsx messages/fr.json messages/en.json
git commit -m "feat(ui-cleanup): retire l'encart Dernière analyse de la sidebar"
```

---

## Task 4 : VaultMarkdown — wikilinks sans crochets, supprimer FrontmatterPanel

**Files:**
- Modify: `components/admin/vault-markdown.tsx`

- [ ] **Step 4.1 : Modifier `components/admin/vault-markdown.tsx` — retrait FrontmatterPanel et refonte rendering wikilinks**

Remplacer entièrement le contenu de `components/admin/vault-markdown.tsx` par :

```tsx
"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseFrontmatter } from "@/lib/vault/frontmatter";
import { humanizeSlug } from "@/lib/vault/label";

type PageIndexEntry = { slug: string; path: string; title?: string };

export function VaultMarkdown({
  raw,
  pageIndex,
  pageTitle,
}: {
  raw: string;
  pageIndex: PageIndexEntry[];
  pageTitle?: string;
}) {
  // On ignore le frontmatter pour le rendu (les métadonnées affichées
  // sont gérées en amont par MemoryView ou le PageHeader).
  const { content } = useMemo(() => parseFrontmatter(raw), [raw]);

  const slugIndex = useMemo(() => {
    const map = new Map<string, { path: string; title: string | null }>();
    for (const p of pageIndex) {
      map.set(p.slug, { path: p.path, title: p.title ?? null });
    }
    return map;
  }, [pageIndex]);

  // Le PageHeader affiche déjà le titre — on retire le premier h1 du markdown
  // s'il correspond, pour éviter le doublon visuel.
  const dedupedContent = useMemo(() => {
    if (!pageTitle) return content;
    const trimmed = content.replace(/^\s+/, "");
    const m = trimmed.match(/^#\s+(.+?)\s*\n+/);
    if (!m) return content;
    const heading = m[1].trim();
    if (heading === pageTitle.trim()) {
      return trimmed.slice(m[0].length);
    }
    return content;
  }, [content, pageTitle]);

  return (
    <div className="text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-ink">
              {transformChildren(children, slugIndex)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-8 mb-3 border-b border-border/70 pb-1.5 text-lg font-semibold text-ink first:mt-0">
              {transformChildren(children, slugIndex)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {transformChildren(children, slugIndex)}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-3 text-sm leading-relaxed text-ink">
              {transformChildren(children, slugIndex)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 flex flex-col gap-1.5 text-sm text-ink">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed [&>strong:first-child]:mr-0.5 [&>strong:first-child]:text-ink relative pl-4 before:absolute before:left-1 before:top-2.5 before:size-1 before:rounded-full before:bg-muted-foreground/60">
              {transformChildren(children, slugIndex)}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">
              {transformChildren(children, slugIndex)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="text-ink/90">
              {transformChildren(children, slugIndex)}
            </em>
          ),
          hr: () => <hr className="my-6 border-border/70" />,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-brand/40 bg-brand/5 px-4 py-2 text-sm italic text-ink/80">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <code className="block whitespace-pre-wrap rounded-md bg-surface-muted px-3 py-2 font-mono text-xs text-ink">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.85em] text-ink">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-muted">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border last:border-b-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {transformChildren(children, slugIndex)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 align-top text-ink leading-relaxed">
              {transformChildren(children, slugIndex)}
            </td>
          ),
          a: ({ children, href }) =>
            href ? (
              <a
                href={href}
                className="text-brand hover:underline"
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {dedupedContent}
      </ReactMarkdown>
    </div>
  );
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

type SlugIndex = Map<string, { path: string; title: string | null }>;

function transformChildren(
  children: React.ReactNode,
  slugIndex: SlugIndex
): React.ReactNode {
  if (typeof children === "string") {
    return splitText(children, slugIndex);
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <Fragment key={i}>{transformChildren(c, slugIndex)}</Fragment>
    ));
  }
  return children;
}

function splitText(
  text: string,
  slugIndex: SlugIndex
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(WIKILINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const slug = m[1].trim();
    const alias = m[2]?.trim() ?? null;
    const indexed = slugIndex.get(slug);
    const label = alias ?? indexed?.title ?? humanizeSlug(slug);
    if (indexed) {
      parts.push(
        <Link
          key={`w-${i}-${idx}`}
          href={`/admin/vault/${indexed.path.replace(/\.md$/, "")}`}
          className="font-medium text-brand hover:underline"
        >
          {label}
        </Link>
      );
    } else {
      // Slug orphelin : afficher le label humanisé sans crochets ni annotation
      parts.push(
        <span key={`w-${i}-${idx}`} className="text-ink">
          {label}
        </span>
      );
    }
    last = idx + m[0].length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
```

Changements clés :
- Suppression complète de `FrontmatterPanel` et de l'encart "Frontmatter YAML".
- `splitText` : les wikilinks rendent désormais le label sans crochets, avec lookup de title via `pageIndex`.
- Slugs orphelins : humanisation au lieu de `[[slug]] (cible non créée)`.

- [ ] **Step 4.2 : Mettre à jour les call-sites pour passer `title` dans `pageIndex`**

Le composant attend maintenant `pageIndex: { slug; path; title? }[]`. Vérifier les 2 call-sites :

Run: `grep -rn "VaultMarkdown\|MemoryView" /Users/raphaelzakine/Desktop/Clinic-OS/app /Users/raphaelzakine/Desktop/Clinic-OS/components | grep -v "\.test\." | head -10`

Les fichiers identifiés sont :
- `app/admin/vault/[...path]/page.tsx` (utilisation directe)
- `app/patients/[id]/page.tsx` (via MemoryView)
- `components/patients/memory-view.tsx` (passe à VaultMarkdown)

Modifier `app/admin/vault/[...path]/page.tsx` autour des lignes 36-39 :

```tsx
  const pageIndex = allPages.map((p) => ({
    slug: p.path.replace(/^.*\//, "").replace(/\.md$/, ""),
    path: p.path,
    title: p.title,
  }));
```

Modifier `app/patients/[id]/page.tsx` autour des lignes 64-67 :

```tsx
  const pageIndex = allPages.map((p) => ({
    slug: p.path.replace(/^.*\//, "").replace(/\.md$/, ""),
    path: p.path,
    title: p.title,
  }));
```

Modifier `components/patients/memory-view.tsx` ligne 9 :

```tsx
type PageIndexEntry = { slug: string; path: string; title?: string };
```

(la prop est déjà transmise verbatim via `pageIndex={pageIndex}` aux VaultMarkdown internes).

- [ ] **Step 4.3 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 4.4 : Vérification visuelle**

Run: `pnpm dev` puis ouvrir `/admin/vault/patients/mme-isabelle-lefevre` (ou autre fiche existante).
Expected :
- Plus d'encart "Frontmatter YAML"
- Wikilinks affichés comme `Centre Lyon 3` (sans `[[...]]`), cliquables vers la fiche cible
- Slugs orphelins : affichés humanisés (ex: `Objection Prix Non Traitée`) sans annotation

Tuer le serveur après vérification.

- [ ] **Step 4.5 : Commit**

```bash
git add -u components/admin/vault-markdown.tsx app/admin/vault/[...path]/page.tsx app/patients/[id]/page.tsx components/patients/memory-view.tsx
git commit -m "feat(ui-cleanup): wikilinks sans crochets + suppression frontmatter UI"
```

---

## Task 5 : Vault page index — badge type au lieu du chemin `.md`

**Files:**
- Modify: `app/admin/vault/page.tsx`

- [ ] **Step 5.1 : Modifier `app/admin/vault/page.tsx` — remplacer le chemin par badge type**

Remplacer les lignes 102-117 (bloc `<ul>` de la liste de pages) par :

```tsx
              <ul className="flex flex-col divide-y divide-border/60">
                {pages.map((p) => (
                  <li key={p.path} className="py-2">
                    <Link
                      href={`/admin/vault/${p.path.replace(/\.md$/, "")}`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm transition hover:bg-surface-muted"
                    >
                      <span className="truncate font-medium text-ink">{p.title}</span>
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t(`kindLabel.${kind as Kind}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
```

Changements :
- `{p.path}` (chemin `.md`) → badge avec libellé métier de la kind (`Patient`, `Audioprothésiste`, etc.)
- Les clés i18n `vault.kindLabel.*` ont été ajoutées en Task 1.

- [ ] **Step 5.2 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 5.3 : Vérification visuelle**

Run: `pnpm dev` puis ouvrir `/admin/vault`.
Expected :
- Sous-titre n'affiche plus "Obsidian"
- CTA principal lit "Exporter (.zip)" (FR) / "Export (.zip)" (EN)
- Aucune colonne ne montre les chemins `.md` ; à la place, un badge type ("Patient", "Audioprothésiste", etc.)

Tuer le serveur après.

- [ ] **Step 5.4 : Commit**

```bash
git add -u app/admin/vault/page.tsx
git commit -m "feat(ui-cleanup): vault index - badge type au lieu du chemin .md"
```

---

## Task 6 : Vault page détail — refonte header et suppression panneaux backlinks

**Files:**
- Modify: `app/admin/vault/[...path]/page.tsx`

- [ ] **Step 6.1 : Modifier `app/admin/vault/[...path]/page.tsx` — refonte complète**

Remplacer entièrement le contenu de `app/admin/vault/[...path]/page.tsx` par :

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { vaultPages } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { VaultMarkdown } from "@/components/admin/vault-markdown";
import { Button } from "@/components/ui/button";
import { getVaultPageByPath } from "@/lib/vault/ingest";

type Kind = "index" | "practitioner" | "assistant" | "center" | "patient" | "pattern" | "session";

export default async function VaultPagePage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/") + (pathSegments.join("/").endsWith(".md") ? "" : ".md");

  const [page, allPages] = await Promise.all([
    getVaultPageByPath(path),
    db
      .select({ path: vaultPages.path, title: vaultPages.title })
      .from(vaultPages)
      .orderBy(asc(vaultPages.path)),
  ]);

  if (!page) {
    notFound();
  }

  const t = await getTranslations("vault");
  const locale = await getLocale();

  const pageIndex = allPages.map((p) => ({
    slug: p.path.replace(/^.*\//, "").replace(/\.md$/, ""),
    path: p.path,
    title: p.title,
  }));

  const kindLabel = t(`kindLabel.${page.kind as Kind}`);
  const updatedAt = page.updatedAt
    ? page.updatedAt.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={page.title}
        description={`${kindLabel} · ${t("updatedAtSuffix", { date: updatedAt })}`}
        actions={
          <Link href="/admin/vault">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" aria-hidden />
              {t("backToList")}
            </Button>
          </Link>
        }
      />

      <div className="rounded-lg border border-border bg-surface px-6 py-5">
        <VaultMarkdown
          raw={page.contentMd}
          pageIndex={pageIndex}
          pageTitle={page.title}
        />
      </div>
    </div>
  );
}
```

Changements :
- Suppression de l'import `getInboundBacklinks` et de la requête associée
- Suppression de `outboundResolved` et `inbound`
- Suppression des 2 `<BacklinkPanel>` et de la fonction `BacklinkPanel`
- Suppression de la grille `lg:grid-cols-12` — le markdown prend toute la largeur
- Description du PageHeader : utilise `kindLabel` traduit + `updatedAtSuffix` formaté
- Hardcoded "Retour à la liste" → `t("backToList")` (clé i18n existante)

- [ ] **Step 6.2 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 6.3 : Vérification visuelle**

Run: `pnpm dev` puis ouvrir `/admin/vault/patients/mme-isabelle-lefevre`.
Expected :
- Sous le titre : `Patient · mis à jour le 28 avril 2026` (pas de chemin `.md`, pas d'heure)
- Pas de panneaux "Liens sortants" / "Liens entrants" sur la droite
- Markdown rend en pleine largeur

Tuer le serveur après.

- [ ] **Step 6.4 : Commit**

```bash
git add -u app/admin/vault/[...path]/page.tsx
git commit -m "feat(ui-cleanup): vault détail - refonte header, suppression panneaux backlinks"
```

---

## Task 7 : Fiche patient — résolution wikilinks dans inlineMeta

**Files:**
- Modify: `components/patients/memory-view.tsx`

- [ ] **Step 7.1 : Modifier `components/patients/memory-view.tsx` — rendre les wikilinks dans `m.value`**

Remplacer le bloc `inlineMeta` (lignes 43-59 actuelles) par un rendu qui résout les wikilinks. Le `inlineMeta.value` peut contenir `[[lyon-3]]` ou `[[jonathan-goldminc|Dr Goldminc]]`.

Modifications dans `components/patients/memory-view.tsx` :

Ajouter en haut du fichier, après les imports existants :

```tsx
import Link from "next/link";
import { Fragment } from "react";
import { humanizeSlug } from "@/lib/vault/label";
```

Ajouter ces helpers en bas du fichier (après `SectionCard`) :

```tsx
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function renderInlineValue(
  value: string,
  pageIndex: PageIndexEntry[]
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of value.matchAll(WIKILINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(value.slice(last, idx));
    const slug = m[1].trim();
    const alias = m[2]?.trim() ?? null;
    const indexed = pageIndex.find((p) => p.slug === slug);
    const label = alias ?? indexed?.title ?? humanizeSlug(slug);
    if (indexed) {
      parts.push(
        <Link
          key={`v-${i}-${idx}`}
          href={`/admin/vault/${indexed.path.replace(/\.md$/, "")}`}
          className="text-brand hover:underline"
        >
          {label}
        </Link>
      );
    } else {
      parts.push(<Fragment key={`v-${i}-${idx}`}>{label}</Fragment>);
    }
    last = idx + m[0].length;
    i += 1;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts.length > 0 ? parts : value;
}
```

Modifier le bloc inlineMeta (ligne 43-59 actuelle) en :

```tsx
      {parsed.inlineMeta.length > 0 && (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {parsed.inlineMeta.map((m) => (
            <div
              key={`${m.key}-${m.value}`}
              className="flex flex-col rounded-md border border-border bg-surface-muted/60 px-3 py-2"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {m.key}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {renderInlineValue(m.value, pageIndex)}
              </dd>
            </div>
          ))}
        </dl>
      )}
```

- [ ] **Step 7.2 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 7.3 : Vérification visuelle**

Run: `pnpm dev` puis ouvrir `/patients/<id>` pour M. Henri Martin.
Expected :
- Le bloc "Mémoire" à droite affiche `Centre : Centre Lyon 3` (pas `[[lyon-3]]`) et `Audioprothésiste suivi : Dr Jonathan Goldminc` (pas `[[jonathan-goldminc]]`)
- La synthèse parcours rend les wikilinks transformés en liens nommés

Tuer le serveur après.

- [ ] **Step 7.4 : Commit**

```bash
git add -u components/patients/memory-view.tsx
git commit -m "feat(ui-cleanup): fiche patient - résolution wikilinks dans inlineMeta"
```

---

## Task 8 : Backend retrieval — enrichir avec `programTitle` et `moduleTitle`

**Files:**
- Modify: `lib/retrieval/search.ts`

- [ ] **Step 8.1 : Lire le fichier actuel pour comprendre la structure**

Run: `wc -l /Users/raphaelzakine/Desktop/Clinic-OS/lib/retrieval/search.ts && head -120 /Users/raphaelzakine/Desktop/Clinic-OS/lib/retrieval/search.ts`

Note : ce fichier renvoie le type `RetrievalResult` consommé par `synthesize.ts` (Cmd+K) et probablement par les insights de la page résultats. Vérifier les usages :

Run: `grep -rn "RetrievalResult\|programSlug\|moduleNumber" /Users/raphaelzakine/Desktop/Clinic-OS/lib /Users/raphaelzakine/Desktop/Clinic-OS/app /Users/raphaelzakine/Desktop/Clinic-OS/components 2>/dev/null | grep -v node_modules | head -30`

- [ ] **Step 8.2 : Modifier `lib/retrieval/search.ts` — ajouter programTitle / moduleTitle**

Sans toucher à la signature, étendre le type `RetrievalResult` exporté pour inclure :

```typescript
export type RetrievalResult = {
  id: string;
  sourceFile: string;
  sourceType: string;
  programSlug: string | null;
  programTitle: string | null;       // NOUVEAU
  moduleNumber: number | null;
  moduleTitle: string | null;        // NOUVEAU
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown> | null;
  driveFileId: string | null;
  similarity: number;
  // Champs métadata existants utiles à l'UI :
  startSeconds: number | null;
  pageNumber: number | null;
};
```

Modifier la requête SQL principale (`semanticSearch` ou équivalent) pour joindre `programs` (sur `slug`) et `modules` (sur `program_id` + `number`) et exposer leur `title`.

Pseudocode SQL à intégrer dans la fonction (le SQL exact dépend de la requête actuelle qui doit être lue avant) :

```sql
SELECT
  kc.*,
  p.title as program_title,
  m.title as module_title,
  (kc.metadata->>'startSeconds')::float as start_seconds,
  (kc.metadata->>'pageNumber')::int as page_number,
  (1 - (kc.embedding <=> $1::vector)) as similarity
FROM knowledge_chunks kc
LEFT JOIN programs p ON p.slug = kc.program_slug
LEFT JOIN modules m ON m.program_id = p.id AND m.number = kc.module_number
ORDER BY kc.embedding <=> $1::vector
LIMIT $2
```

Mapper les champs `program_title`, `module_title`, `start_seconds`, `page_number` dans le retour TypeScript.

**Important** : si la fonction utilise déjà drizzle ORM avec un join, adapter en conséquence ; si elle utilise SQL brut, ajouter les colonnes au SELECT et au mapping.

- [ ] **Step 8.3 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur. Les champs ajoutés sont optionnels (nullable) donc les call-sites existants compilent toujours sans modification.

- [ ] **Step 8.4 : Vérifier que le retour API inclut bien les nouveaux champs**

Lancer `pnpm dev` et tester avec curl :

Run: `curl -X POST http://localhost:3000/api/search -H 'content-type: application/json' -d '{"query":"objection prix"}' --no-buffer | head -50`

Vérifier que le payload `sources` du SSE contient `programTitle` et `moduleTitle`.

Tuer le serveur après.

- [ ] **Step 8.5 : Commit**

```bash
git add -u lib/retrieval/search.ts
git commit -m "feat(ui-cleanup): retrieval expose programTitle et moduleTitle"
```

---

## Task 9 : Cmd+K — reformat sources en langage métier

**Files:**
- Modify: `components/layout/search-trigger.tsx`

- [ ] **Step 9.1 : Modifier le type `Source` dans `components/layout/search-trigger.tsx`**

Étendre le type local `Source` (lignes 23-34 actuelles) pour matcher le nouveau retour API :

```tsx
type Source = {
  id: string;
  sourceFile: string;
  sourceType: string;
  programSlug: string | null;
  programTitle: string | null;       // NOUVEAU
  moduleNumber: number | null;
  moduleTitle: string | null;        // NOUVEAU
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown> | null;
  driveFileId: string | null;
  similarity: number;
  startSeconds: number | null;       // NOUVEAU
  pageNumber: number | null;         // NOUVEAU
};
```

- [ ] **Step 9.2 : Reformater le rendu des sources**

Ajouter en haut du fichier :

```tsx
import { useLocale } from "next-intl";
import { formatSourceCitation } from "@/lib/format/source-citation";
```

Note : `useLocale` vient de `next-intl` côté client. Si l'import existe déjà via `useTranslations`, vérifier.

Récupérer la locale dans `SearchBody` :

```tsx
function SearchBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "fr" | "en";
  // ... reste inchangé
```

Remplacer le bloc des lignes 372-403 (rendu des sources) par :

```tsx
            {sources.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("sources", { count: sources.length })}
                </p>
                <ol className="flex flex-col gap-1.5">
                  {sources.map((s, idx) => (
                    <li
                      key={s.id}
                      className={cn(
                        "grid grid-cols-[auto,1fr] items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-xs"
                      )}
                    >
                      <span className="font-mono text-muted-foreground">
                        [{idx + 1}]
                      </span>
                      <span className="truncate text-ink">
                        {formatSourceCitation(
                          {
                            programTitle: s.programTitle,
                            moduleNumber: s.moduleNumber,
                            moduleTitle: s.moduleTitle,
                            startSeconds: s.startSeconds,
                            pageNumber: s.pageNumber,
                            sourceType: s.sourceType,
                          },
                          locale
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
```

Changements :
- Suppression de la grille à 3 colonnes (le score à droite disparaît)
- Suppression de l'affichage du `sourceFile`, du `programSlug`, du `module ${moduleNumber}`, et du score `similarity.toFixed(2)`
- Le contenu textuel de la source est généré par `formatSourceCitation`

- [ ] **Step 9.3 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 9.4 : Vérification visuelle**

Run: `pnpm dev`. Ouvrir `/`, presser Cmd+K, taper `objection prix classe 2`, presser Entrée.
Expected :
- Sources affichées sous le format `Audio Vente · Module N — Titre du module` (FR) ou avec timestamp/page si vidéo/PDF
- Plus de score numérique
- Plus de nom de fichier `.pdf`

Tuer le serveur après.

- [ ] **Step 9.5 : Commit**

```bash
git add -u components/layout/search-trigger.tsx
git commit -m "feat(ui-cleanup): Cmd+K - sources en format métier (programme · module · titre)"
```

---

## Task 10 : Page résultats — onglet Coaching

**Files:**
- Modify: `components/results/results-view.tsx`

- [ ] **Step 10.1 : Vérifier la structure du type `InsightCitation`**

Run: `grep -rn "InsightCitation\|type Citation" /Users/raphaelzakine/Desktop/Clinic-OS/components /Users/raphaelzakine/Desktop/Clinic-OS/lib /Users/raphaelzakine/Desktop/Clinic-OS/app 2>/dev/null | head -10`

Le type `InsightCitation` est dérivé du retrieval (probablement défini dans `lib/results/...` ou similaire). Si les champs `programTitle` / `moduleTitle` ne sont pas encore exposés, il faut les ajouter à la jointure SQL côté backend qui charge les insights.

Lire le fichier qui charge les citations :

Run: `grep -rn "coaching_insights\|InsightCitation" /Users/raphaelzakine/Desktop/Clinic-OS/lib 2>/dev/null | head -10`

- [ ] **Step 10.2 : Étendre la requête de citations pour inclure programTitle / moduleTitle**

Identifier la fonction qui assemble les citations (probablement dans `lib/results/bundle.ts` ou similaire). Étendre la sélection SQL pour joindre `programs` (sur slug) et `modules` (sur program_id + number) et exposer `programTitle` / `moduleTitle` dans le type `InsightCitation`.

Mêmes lignes directrices qu'à la Task 8 : LEFT JOIN sur `programs` et `modules`, ajout des colonnes au mapping TypeScript.

- [ ] **Step 10.3 : Modifier le rendu dans `components/results/results-view.tsx` (lignes 440-443)**

Importer en haut du fichier :

```tsx
import { useLocale } from "next-intl";
import { formatSourceCitation } from "@/lib/format/source-citation";
```

Dans `Citations`, récupérer la locale :

```tsx
function Citations({ citations }: { citations: InsightCitation[] }) {
  const t = useTranslations("results");
  const locale = useLocale() as "fr" | "en";
  // ... reste
```

Remplacer le bloc `inner` (lignes 434-444 actuelles) par :

```tsx
          const inner = (
            <>
              <MessageSquare
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate text-muted-foreground">
                <span className="text-ink">
                  {formatSourceCitation(
                    {
                      programTitle: c.programTitle,
                      moduleNumber: c.moduleNumber,
                      moduleTitle: c.moduleTitle,
                      startSeconds: c.startSeconds ?? null,
                      pageNumber: c.pageNumber ?? null,
                      sourceType: c.sourceType,
                    },
                    locale
                  )}
                </span>
              </span>
            </>
          );
```

Suppression de `c.sourceFile` et de `· module ${c.moduleNumber}`.

- [ ] **Step 10.4 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 10.5 : Vérification visuelle**

Run: `pnpm dev`. Ouvrir une page de résultats existante (`/sessions/<id>/results` ou `/results/<id>` selon le routing). Aller à l'onglet "Coaching".
Expected :
- Chaque citation affiche `Audio Vente · Module N — Titre`
- Plus de nom de fichier brut, plus de "module" séparé du titre

Tuer le serveur après.

- [ ] **Step 10.6 : Commit**

```bash
git add -u components/results/results-view.tsx lib/results/<file-modified>.ts
git commit -m "feat(ui-cleanup): page résultats coaching - citations en format métier"
```

---

## Task 11 : Page résultats — onglet Mémoire (libellés métier)

**Files:**
- Modify: `components/results/results-view.tsx`

- [ ] **Step 11.1 : Modifier `components/results/results-view.tsx` — `VaultLinkCard` ligne 602-604**

Remplacer le bloc :

```tsx
      <p className="mt-3 truncate text-xs font-mono text-brand group-hover:underline">
        {link.path}
      </p>
```

Par :

```tsx
      <p className="mt-3 truncate text-xs font-medium text-brand group-hover:underline">
        {link.title}
      </p>
```

Changements : utiliser le `title` (ex: "Dr Jonathan Goldminc") au lieu du chemin `.md` (`practitioners/jonathan-goldminc.md`). Police monospace remplacée par `font-medium`.

- [ ] **Step 11.2 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 11.3 : Vérification visuelle**

Run: `pnpm dev`. Aller à l'onglet "Mémoire" d'une page de résultats.
Expected :
- Cartes "Fiche audioprothésiste" et "Fiche session" affichent un titre métier (`Dr Jonathan Goldminc`, `Mme Durand — session du 28 avril`) et non plus un chemin `.md`

Tuer le serveur après.

- [ ] **Step 11.4 : Commit**

```bash
git add -u components/results/results-view.tsx
git commit -m "feat(ui-cleanup): page résultats mémoire - libellés métier au lieu de chemins .md"
```

---

## Task 12 : Admin Knowledge — StatusPill traduit, timestamp formaté

**Files:**
- Modify: `app/admin/knowledge/page.tsx`

- [ ] **Step 12.1 : Modifier `app/admin/knowledge/page.tsx` — StatusPill et timestamp**

Modifier la fonction `StatusPill` (lignes 190-205 actuelles) pour traduire le label :

```tsx
function StatusPill({
  status,
  labels,
}: {
  status: string;
  labels: { success: string; partial: string; failed: string; running: string };
}) {
  const map: Record<string, { className: string; label: string }> = {
    success: { className: "bg-emerald-100 text-emerald-800", label: labels.success },
    partial: { className: "bg-amber-100 text-amber-800", label: labels.partial },
    failed: { className: "bg-red-100 text-red-800", label: labels.failed },
    running: {
      className: "bg-blue-100 text-blue-800 animate-pulse",
      label: labels.running,
    },
  };
  const entry = map[status] ?? { className: "bg-surface text-muted-foreground", label: status };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}
```

Au call-site (autour de la ligne 165), passer les labels traduits depuis `t.raw('runStatus')` :

```tsx
                <StatusPill
                  status={run.status ?? "running"}
                  labels={t.raw("runStatus") as {
                    success: string;
                    partial: string;
                    failed: string;
                    running: string;
                  }}
                />
```

Modifier la ligne 156 (timestamp ISO brut) pour utiliser `toLocaleString` selon la locale :

```tsx
                  <p className="truncate font-mono text-[11px] text-ink">
                    {run.startedAt
                      ? run.startedAt.toLocaleString(
                          locale === "en" ? "en-GB" : "fr-FR",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "—"}
                  </p>
```

(`locale` est déjà disponible dans le composant via `await getLocale()` ligne 17.)

- [ ] **Step 12.2 : Retirer le bloc `<code>pnpm ingest</code>`**

Modifier les lignes 141-143 (description des runs) pour retirer la référence au CLI :

Avant :
```tsx
            <p className="text-xs text-muted-foreground">
              {t("runsDescription")}
              <code className="rounded bg-surface-muted px-1 py-0.5">pnpm ingest</code>.
            </p>
```

Après :
```tsx
            <p className="text-xs text-muted-foreground">
              {t("runsDescription")}
            </p>
```

Modifier également les lignes 122-125 (`filesEmpty`) pour retirer le `<code>pnpm ingest</code>` dans `components/admin/files-table.tsx` (cf. Task 13).

- [ ] **Step 12.3 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 12.4 : Vérification visuelle**

Run: `pnpm dev`. Ouvrir `/admin/knowledge`.
Expected :
- KPIs disent "Passages totaux" (FR) / "Total passages" (EN)
- "Volume par programme" : la ligne sous chaque programme dit `12 fichiers` (sans "slug : ...")
- "Volume par programme" : la valeur de droite dit `156 passages` (au lieu de `chunks`)
- "Derniers runs d'ingestion" : pills traduits (`Réussi`, `Échec`, `En cours`, `Partiel`)
- Timestamps formatés `28 avr. 2026, 14:35` (au lieu de `2026-04-28 14:35:02`)
- Plus de mention `pnpm ingest` dans la description

Tuer le serveur après.

- [ ] **Step 12.5 : Commit**

```bash
git add -u app/admin/knowledge/page.tsx
git commit -m "feat(ui-cleanup): admin knowledge - StatusPill traduit + timestamps formatés"
```

---

## Task 13 : Files-table — header par titre programme + retrait drive_folder_path

**Files:**
- Modify: `components/admin/files-table.tsx`

- [ ] **Step 13.1 : Modifier `components/admin/files-table.tsx` — charger les programmes et utiliser leur title**

Remplacer entièrement le contenu de `components/admin/files-table.tsx` par :

```tsx
import { sql, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db/client";
import { programs } from "@/db/schema";
import { FileText, Mic, Sheet } from "lucide-react";

type IngestedFile = {
  drive_file_id: string;
  source_file: string;
  source_type: "pdf" | "video_transcript" | "docx";
  program_slug: string | null;
  module_number: number | null;
  chunk_count: number;
  last_modified: string;
};

const TYPE_ICON = {
  pdf: FileText,
  docx: Sheet,
  video_transcript: Mic,
} as const;

export async function FilesTable() {
  const t = await getTranslations("admin.knowledge");
  const TYPE_LABEL = {
    pdf: "PDF",
    docx: "DOCX",
    video_transcript: t("videoLabel"),
  } as const;

  const [rows, programRows] = await Promise.all([
    db.execute<IngestedFile>(sql`
      SELECT
        drive_file_id,
        source_file,
        source_type::text as source_type,
        program_slug,
        module_number,
        max(drive_modified_at)::text as last_modified,
        count(*)::int as chunk_count
      FROM knowledge_chunks
      GROUP BY drive_file_id, source_file, source_type, program_slug, module_number
      ORDER BY program_slug NULLS LAST, source_file
    `),
    db.select({ slug: programs.slug, title: programs.title }).from(programs),
  ]);

  const slugToTitle = new Map<string, string>();
  for (const p of programRows) slugToTitle.set(p.slug, p.title);

  const grouped = rows.reduce<Record<string, IngestedFile[]>>((acc, row) => {
    const key = row.program_slug ?? "autres";
    (acc[key] ??= []).push(row);
    return acc;
  }, {});

  const programOrder = [
    "reference",
    "personnel-accueil",
    "convaincre-telephone",
    "audio-vente",
    "autres",
  ].filter((k) => grouped[k]?.length);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div>
        <h2 className="text-base font-semibold">{t("filesTitle")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("filesDescription", { count: rows.length })}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {programOrder.map((slug) => {
          const files = grouped[slug];
          const totalChunks = files.reduce((sum, f) => sum + f.chunk_count, 0);
          const groupTitle = slug === "autres" ? t("groupOthers") : slugToTitle.get(slug) ?? slug;
          return (
            <div key={slug} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 pb-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupTitle}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("filesGroupSummary", { files: files.length, chunks: totalChunks })}
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface-muted">
                {files.map((f) => {
                  const Icon = TYPE_ICON[f.source_type] ?? FileText;
                  return (
                    <li
                      key={f.drive_file_id}
                      className="grid grid-cols-[auto,1fr,auto,auto,auto] items-center gap-3 px-3 py-2 text-sm"
                    >
                      <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{f.source_file}</p>
                      </div>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {TYPE_LABEL[f.source_type] ?? f.source_type}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {f.module_number ? t("moduleShort", { n: f.module_number }) : "—"}
                      </span>
                      <span className="w-16 text-right text-xs tabular-nums text-ink">
                        {t("fileChunks", { count: f.chunk_count })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted-foreground">
            {t("filesEmpty")}
          </p>
        )}
      </div>
    </div>
  );
}
```

Changements :
- Chargement des programmes (table `programs`) + lookup slug → title
- Header de groupe affiche `slugToTitle.get(slug)` (ex: `Audio Vente — Base`) au lieu du slug
- Suppression complète du bloc `f.drive_folder_path` (lignes 97-102 originales)
- Suppression de l'import `Folder` (plus utilisé)
- Suppression du SQL `metadata->>'driveFolderPath' as drive_folder_path` (plus utilisé)
- Suppression de la mention `pnpm ingest` dans le bloc empty
- `m${f.module_number}` remplacé par `t("moduleShort", { n: ... })` → "M3" en FR/EN

- [ ] **Step 13.2 : Ajouter les nouvelles clés i18n**

Dans `messages/fr.json`, sous `admin.knowledge` :

```json
"groupOthers": "Autres",
"moduleShort": "M{n}"
```

Dans `messages/en.json`, sous `admin.knowledge` :

```json
"groupOthers": "Others",
"moduleShort": "M{n}"
```

- [ ] **Step 13.3 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 13.4 : Vérification visuelle**

Run: `pnpm dev`. Ouvrir `/admin/knowledge`, scroller jusqu'à "Fichiers ingérés".
Expected :
- Headers de groupe : `AUDIO VENTE — BASE` (titre programme) au lieu de `audio-vente-base`
- Sous chaque fichier, plus de chemin Google Drive `/Mon Drive/...`
- Module : `M3` au lieu de `m3`
- Compteur : `12 passages` au lieu de `12 chunks`

Tuer le serveur après.

- [ ] **Step 13.5 : Commit**

```bash
git add -u components/admin/files-table.tsx messages/fr.json messages/en.json
git commit -m "feat(ui-cleanup): files-table - header par titre programme, retrait drive_folder_path"
```

---

## Task 14 : Retrieval test — disclosure + capitalisation

**Files:**
- Modify: `components/admin/retrieval-test.tsx`

- [ ] **Step 14.1 : Modifier `components/admin/retrieval-test.tsx` — wrapper `<details>` et capitaliser "Module"**

Remplacer entièrement le contenu de `components/admin/retrieval-test.tsx` par :

```tsx
"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { runRetrievalTest, type SearchState } from "@/app/admin/knowledge/actions";

const INITIAL: SearchState = { query: "", results: [] };

export function RetrievalTest() {
  const t = useTranslations("admin.knowledge");
  const [state, action, pending] = useActionState(runRetrievalTest, INITIAL);
  const samples = (t.raw("retrievalSamples") as string[]) ?? [];

  return (
    <details className="group rounded-lg border border-border bg-surface p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("retrievalTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("retrievalDescription")}</p>
        </div>
        <span className="text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-4">
        <form action={action} className="flex gap-2">
          <Input
            name="query"
            defaultValue={state.query}
            placeholder={t("retrievalPlaceholder")}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={pending}
            className="bg-brand text-primary-foreground hover:bg-brand-dark"
          >
            <Search className="size-4" aria-hidden />
            {pending ? t("retrievalSearching") : t("retrievalSearch")}
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {samples.map((q) => (
            <form key={q} action={action}>
              <input type="hidden" name="query" value={q} />
              <button
                type="submit"
                className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
              >
                {q}
              </button>
            </form>
          ))}
        </div>

        {state.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}

        {state.query && !state.error && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("retrievalCount", {
                count: state.results.length,
                ms: state.durationMs ?? 0,
              })}
            </span>
            <span>{t("retrievalQueryLabel", { query: state.query })}</span>
          </div>
        )}

        {state.results.length > 0 && (
          <ol className="flex flex-col gap-2">
            {state.results.map((r, idx) => (
              <li
                key={r.id}
                className={cn(
                  "rounded-md border border-border bg-surface-muted px-4 py-3 text-sm"
                )}
              >
                <div className="mb-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono text-ink">#{idx + 1}</span>
                  <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-brand">
                    {r.similarity.toFixed(3)}
                  </span>
                  <span className="truncate">
                    {r.programSlug ?? "—"}
                    {r.moduleNumber ? ` · ${t("moduleShort", { n: r.moduleNumber })}` : ""}
                  </span>
                  <span className="ml-auto truncate text-[11px]">
                    {r.sourceType} · {r.sourceFile}
                  </span>
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap text-ink/90">
                  {r.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
```

Changements :
- Tout le contenu est wrappé dans `<details>` avec un summary cliquable
- Le titre "Outil de diagnostic" et la description (déjà mis à jour i18n en Task 1) servent de bouton de toggle
- "module" anglais (ligne 90) → `t("moduleShort", { n: ... })` ("M3")
- Les scores cosinus, sourceType et sourceFile sont conservés (vocation debug assumée)

- [ ] **Step 14.2 : Vérifier compilation**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 14.3 : Vérification visuelle**

Run: `pnpm dev`. Ouvrir `/admin/knowledge`.
Expected :
- "Outil de diagnostic" est replié par défaut
- Cliquer dessus le déplie ; à l'intérieur, scores et fichiers bruts sont conservés
- "module 3" → "M3"

Tuer le serveur après.

- [ ] **Step 14.4 : Commit**

```bash
git add -u components/admin/retrieval-test.tsx
git commit -m "feat(ui-cleanup): retrieval-test - disclosure + capitalisation Module"
```

---

## Task 15 : Smoke test final + nettoyage i18n résiduel

**Files:**
- Modify: `messages/fr.json`, `messages/en.json` (final pass)

- [ ] **Step 15.1 : Grep final des termes interdits**

Run cette commande qui doit retourner zéro résultat dans le code source (hors `messages/*.json`, `docs/`, `node_modules`) :

```bash
grep -rn "\[\[\|Frontmatter YAML\|Obsidian\| chunks\|cosine\|wikilink\|backlink\| slug \|cible non créée" /Users/raphaelzakine/Desktop/Clinic-OS/components /Users/raphaelzakine/Desktop/Clinic-OS/app /Users/raphaelzakine/Desktop/Clinic-OS/lib 2>/dev/null | grep -v "\.test\.\|node_modules\|\.next" | grep -v "wikilinks\.ts\|frontmatter\.ts\|extractWikilinks\|parseWikilinks\|WIKILINK_RE"
```

Expected : aucune occurrence (sauf dans les utilitaires backend `wikilinks.ts` et `frontmatter.ts` qui parsent le markdown stocké — légitime).

Si des occurrences résiduelles apparaissent, les traiter au cas par cas avant de continuer.

- [ ] **Step 15.2 : Audit final des `messages/*.json`**

Run cette commande pour repérer le jargon résiduel dans les i18n :

```bash
grep -in "obsidian\|chunks\|wikilink\|backlink\|cosine\|frontmatter\|ingest\b\|re-ingér\|slug\|pipeline" /Users/raphaelzakine/Desktop/Clinic-OS/messages/fr.json /Users/raphaelzakine/Desktop/Clinic-OS/messages/en.json
```

Examiner chaque ligne. Si un cas a été manqué dans les Tasks 1-14, le corriger maintenant.

- [ ] **Step 15.3 : Smoke test démo — toggle FR/EN**

Run: `pnpm dev`. Visiter dans cet ordre :

1. `/` (dashboard) — vérifier sidebar nettoyée (ni Statut système ni Dernière analyse)
2. `/patients/<id>` (Henri Martin ou autre) — bloc Mémoire avec wikilinks résolus
3. `/admin/vault` — sous-titre sans Obsidian, CTA "Exporter (.zip)", badges types
4. `/admin/vault/patients/mme-isabelle-lefevre` — header simplifié, markdown propre, pas de panneaux backlinks
5. Cmd+K → recherche `objection prix` → sources au format métier
6. `/results/<id>` ou page résultats existante → onglet Coaching → citations en format métier ; onglet Mémoire → libellés
7. `/admin/knowledge` → Outil de diagnostic replié, KPIs en passages, statuts traduits

Toggle vers EN dans le header. Refaire les 7 vérifications. Aucune fuite jargon dans aucune locale.

Tuer le serveur après.

- [ ] **Step 15.4 : Vérifier le build production**

Run: `pnpm build`
Expected : build réussi sans erreurs ni warnings TypeScript.

- [ ] **Step 15.5 : Commit final**

S'il reste des nettoyages mineurs sur les i18n :

```bash
git add -u messages/fr.json messages/en.json
git commit -m "feat(ui-cleanup): nettoyage i18n résiduel + audit final"
```

Sinon, ne pas commit (rien à faire).

---

## Notes pour l'engineer qui exécute ce plan

- **Pas de TDD strict** : ce projet n'a pas de framework de tests unitaires (vitest/jest). Chaque tâche se conclut par un grep ou une vérification visuelle ciblée. Si tu ajoutes un test ad-hoc, exécute-le avec `tsx` directement.
- **Rythme de commits** : un commit par Task. Les commits sont l'unité de rollback.
- **Ordre obligatoire** : Tasks 1, 4 et 8 doivent être faites en premier dans cet ordre, parce qu'elles préparent les helpers / types utilisés par les Tasks suivantes. Tasks 2, 3, 5, 6, 7 sont indépendantes les unes des autres et peuvent être réordonnées.
- **Vérification visuelle** : commence chaque session de développement par `pnpm dev`, garde le navigateur ouvert sur le compte localhost, et recharge à chaque modification.
- **Si un type/champ manque** : par exemple `c.startSeconds` n'existe pas encore dans `InsightCitation` à la Task 10. Tu dois l'ajouter dans la requête SQL et le typage avant de l'utiliser. Le plan indique le besoin (Tasks 8 et 10) mais la modélisation exacte dépend de l'état du code.
- **Préfère utiliser `t()` plutôt que des chaînes en dur** : tout texte affiché doit passer par next-intl pour rester bilingue.

---

## Critères d'acceptation finale

Après Task 15, le travail est complet quand tous ces critères sont validés :

1. Grep `[[`, `]]`, `\.md`, `chunks`, `slug`, `Obsidian`, `wikilink`, `backlink`, `frontmatter`, `ingestion`, `cosine` dans `app/`, `components/`, `lib/` retourne **zéro** résultat (hors utilitaires backend de parsing markdown).
2. Aucune occurrence anglaise des statuts `success`, `failed`, `running`, `partial`, `lost`, `won`, `pending` dans les rendus FR (locale FR active).
3. Sidebar contient uniquement : navigation principale + Patients récents + bloc Admin.
4. La fiche Vault d'un patient (test sur Mme Lefèvre et M. Martin) affiche : nom + métadonnées résolues + corps avec wikilinks transformés en liens nommés. Aucun crochet ni chemin `.md` visible.
5. La modal Cmd+K affiche les sources sous le format `Programme · Module N — Titre [· timestamp ou page]`. Aucun nom de fichier ni score visible.
6. Smoke test démo (Step 15.3) passe en FR et en EN.
7. `pnpm tsc --noEmit` et `pnpm build` réussissent sans erreurs ni warnings.
