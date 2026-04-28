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
