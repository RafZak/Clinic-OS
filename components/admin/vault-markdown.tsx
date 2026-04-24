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
}: {
  raw: string;
  pageIndex: { slug: string; path: string }[];
}) {
  const { metadata, content } = useMemo(() => parseFrontmatter(raw), [raw]);

  const slugToPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pageIndex) map.set(p.slug, p.path);
    return map;
  }, [pageIndex]);

  return (
    <div className="flex flex-col gap-5">
      {Object.keys(metadata).length > 0 && <FrontmatterPanel metadata={metadata} />}
      <div
        className={cn(
          "prose prose-sm max-w-none text-ink",
          "prose-headings:text-ink prose-headings:font-semibold",
          "prose-h1:text-2xl prose-h1:mt-0 prose-h1:mb-3",
          "prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2",
          "prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1",
          "prose-p:my-2 prose-p:leading-relaxed",
          "prose-li:my-0.5",
          "prose-strong:text-ink",
          "prose-a:text-brand prose-a:no-underline hover:prose-a:underline"
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p>{transformChildren(children, slugToPath)}</p>,
            li: ({ children }) => <li>{transformChildren(children, slugToPath)}</li>,
            strong: ({ children }) => (
              <strong>{transformChildren(children, slugToPath)}</strong>
            ),
            em: ({ children }) => <em>{transformChildren(children, slugToPath)}</em>,
            h1: ({ children }) => <h1>{transformChildren(children, slugToPath)}</h1>,
            h2: ({ children }) => <h2>{transformChildren(children, slugToPath)}</h2>,
            h3: ({ children }) => <h3>{transformChildren(children, slugToPath)}</h3>,
          }}
        >
          {content}
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
    <div className="rounded-md border border-border/60 bg-surface-muted px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Frontmatter YAML
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="font-mono text-muted-foreground">{k}</dt>
            <dd className="truncate text-ink">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
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
