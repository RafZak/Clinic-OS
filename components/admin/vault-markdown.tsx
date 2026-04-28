"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseFrontmatter } from "@/lib/vault/frontmatter";
import { cn } from "@/lib/utils";

export function VaultMarkdown({
  raw,
  pageIndex,
  pageTitle,
}: {
  raw: string;
  pageIndex: { slug: string; path: string }[];
  pageTitle?: string;
}) {
  const { metadata, content } = useMemo(() => parseFrontmatter(raw), [raw]);

  const slugToPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pageIndex) map.set(p.slug, p.path);
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
    <div className="flex flex-col gap-5">
      {Object.keys(metadata).length > 0 && <FrontmatterPanel metadata={metadata} />}
      <div className="text-ink">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-ink">
                {transformChildren(children, slugToPath)}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-8 mb-3 border-b border-border/70 pb-1.5 text-lg font-semibold text-ink first:mt-0">
                {transformChildren(children, slugToPath)}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {transformChildren(children, slugToPath)}
              </h3>
            ),
            p: ({ children }) => (
              <p className="my-3 text-sm leading-relaxed text-ink">
                {transformChildren(children, slugToPath)}
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
                {transformChildren(children, slugToPath)}
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-ink">
                {transformChildren(children, slugToPath)}
              </strong>
            ),
            em: ({ children }) => (
              <em className="text-ink/90">
                {transformChildren(children, slugToPath)}
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
                {transformChildren(children, slugToPath)}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 align-top text-ink leading-relaxed">
                {transformChildren(children, slugToPath)}
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
    </div>
  );
}

function FrontmatterPanel({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return null;
  return (
    <details className="group rounded-md border border-border/60 bg-surface-muted">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Frontmatter YAML ({entries.length})</span>
        <span className="text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-border/60 px-4 py-3 text-xs sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="font-mono text-muted-foreground">{k}</dt>
            <dd className={cn("truncate text-ink")}>{String(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function transformChildren(
  children: React.ReactNode,
  slugToPath: Map<string, string>
): React.ReactNode {
  if (typeof children === "string") {
    return splitText(children, slugToPath);
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <Fragment key={i}>{transformChildren(c, slugToPath)}</Fragment>
    ));
  }
  return children;
}

function splitText(
  text: string,
  slugToPath: Map<string, string>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(WIKILINK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const slug = m[1].trim();
    const alias = m[2]?.trim() ?? null;
    const path = slugToPath.get(slug);
    const label = alias ?? slug;
    if (path) {
      parts.push(
        <Link
          key={`w-${i}-${idx}`}
          href={`/admin/vault/${path.replace(/\.md$/, "")}`}
          className="rounded bg-brand/10 px-1 text-brand hover:bg-brand/15"
        >
          [[{label}]]
        </Link>
      );
    } else {
      parts.push(
        <span
          key={`w-${i}-${idx}`}
          className="rounded bg-surface-muted px-1 text-muted-foreground"
          title="Cible non créée"
        >
          [[{label}]]
        </span>
      );
    }
    last = idx + m[0].length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
