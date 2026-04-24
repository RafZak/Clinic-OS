"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  regenerateAllArtifacts,
  regenerateArtifact,
} from "@/app/actions/artifacts";
import type { ArtifactRow, ArtifactType } from "@/lib/types/analysis";

type ArtifactDef = {
  type: ArtifactType;
  title: string;
  destination: string;
  icon: typeof FileText;
};

const ARTIFACT_DEFS: ArtifactDef[] = [
  {
    type: "clinical_notes",
    title: "Notes cliniques",
    destination: "Cosium / Otoaccess",
    icon: Stethoscope,
  },
  {
    type: "patient_email",
    title: "Email patient",
    destination: "Outlook / Gmail",
    icon: Mail,
  },
  {
    type: "patient_sms",
    title: "SMS patient",
    destination: "SMS Gateway",
    icon: MessageSquare,
  },
  {
    type: "orl_letter",
    title: "Courrier ORL",
    destination: "Courrier médical",
    icon: FileText,
  },
];

export function ArtifactsPanel({
  sessionId,
  artifacts,
  analysisDone,
}: {
  sessionId: string;
  artifacts: ArtifactRow[];
  analysisDone: boolean;
}) {
  const router = useRouter();
  const byType = useMemo(() => new Map(artifacts.map((a) => [a.type, a])), [artifacts]);
  const okCount = artifacts.length;
  const allReady = okCount === ARTIFACT_DEFS.length;

  // Polling client si l'analyse est done mais les artefacts manquent encore.
  // Toutes les 3 s pendant max 90 s puis on lâche.
  useEffect(() => {
    if (!analysisDone) return;
    if (allReady) return;
    let elapsed = 0;
    const max = 90_000;
    const id = setInterval(() => {
      elapsed += 3000;
      router.refresh();
      if (elapsed >= max) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [analysisDone, allReady, router]);

  const [isRegenerateAllPending, startRegenerateAll] = useTransition();

  if (!analysisDone) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted px-6 py-10 text-center">
        <Sparkles className="mx-auto size-5 text-muted-foreground" aria-hidden />
        <h3 className="mt-3 text-sm font-medium text-ink">
          Livrables disponibles à la fin de l&apos;analyse
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Les 4 livrables (notes cliniques, email, SMS, courrier ORL) seront générés
          automatiquement dès que l&apos;analyse de la session sera terminée.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Livrables post-consultation
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {allReady
              ? "Tous prêts à envoyer. Ce bouton lance une nouvelle génération."
              : `Génération en cours · ${okCount}/${ARTIFACT_DEFS.length} prêts.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isRegenerateAllPending || (!allReady && okCount === 0)}
          onClick={() =>
            startRegenerateAll(async () => {
              await regenerateAllArtifacts(sessionId);
              setTimeout(() => router.refresh(), 1500);
            })
          }
        >
          {isRegenerateAllPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Tout régénérer
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ARTIFACT_DEFS.map((def) => (
          <ArtifactCard
            key={def.type}
            sessionId={sessionId}
            def={def}
            artifact={byType.get(def.type) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function ArtifactCard({
  sessionId,
  def,
  artifact,
}: {
  sessionId: string;
  def: ArtifactDef;
  artifact: ArtifactRow | null;
}) {
  const Icon = def.icon;
  const router = useRouter();
  const [isRegenerating, startRegenerate] = useTransition();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!artifact) return;
    const plain = artifactToPlainText(artifact);
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors (Safari sandboxed)
    }
  };

  const onRegenerate = () =>
    startRegenerate(async () => {
      await regenerateArtifact(sessionId, def.type);
      setTimeout(() => router.refresh(), 1500);
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-brand" aria-hidden />
          <div>
            <h4 className="text-sm font-semibold text-ink">{def.title}</h4>
            <p className="text-[11px] text-muted-foreground">
              Prêt à envoyer vers {def.destination}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            disabled={!artifact}
            className="h-7 px-2 text-xs"
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-7 px-2 text-xs"
          >
            {isRegenerating ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            Régénérer
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border/60 bg-light/40 px-3 py-3">
        {!artifact ? (
          <ArtifactSkeleton />
        ) : (
          <ArtifactContent type={def.type} content={artifact.content} />
        )}
      </div>

      {artifact?.metadata ? <ArtifactMeta metadata={artifact.metadata} /> : null}
    </div>
  );
}

function ArtifactMeta({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as {
    model?: string;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  return (
    <p className="text-[10px] text-muted-foreground">
      {meta.model} · {meta.durationMs ? Math.round(meta.durationMs / 100) / 10 : "?"} s ·{" "}
      {meta.inputTokens ?? "?"} + {meta.outputTokens ?? "?"} tokens
    </p>
  );
}

function ArtifactSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Génération en cours…
      </div>
      <div className="h-2 w-3/4 animate-pulse rounded bg-surface-muted" />
      <div className="h-2 w-2/3 animate-pulse rounded bg-surface-muted" />
      <div className="h-2 w-4/5 animate-pulse rounded bg-surface-muted" />
    </div>
  );
}

function ArtifactContent({ type, content }: { type: ArtifactType; content: string }) {
  if (type === "patient_email") {
    return <EmailRenderer content={content} />;
  }
  if (type === "patient_sms") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{content.length} caractères</p>
        <p className="text-sm text-ink">{content}</p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-ink",
        "prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-ink prose-headings:font-semibold",
        "prose-h2:text-sm prose-h3:text-xs",
        "prose-p:my-1 prose-p:text-sm prose-p:leading-relaxed",
        "prose-ul:my-1 prose-li:my-0 prose-li:text-sm",
        "prose-strong:text-ink"
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function EmailRenderer({ content }: { content: string }) {
  const parsed = useMemo<{ subject: string; bodyMd: string } | null>(() => {
    try {
      const obj = JSON.parse(content) as { subject?: string; body_html?: string };
      if (typeof obj.subject !== "string" || typeof obj.body_html !== "string") return null;
      return { subject: obj.subject, bodyMd: htmlToMarkdown(obj.body_html) };
    } catch {
      return null;
    }
  }, [content]);

  if (!parsed) {
    return <p className="text-xs text-muted-foreground">Format email invalide.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Objet</span>
        <p className="text-sm font-medium text-ink">{parsed.subject}</p>
      </div>
      <div className="border-t border-border/60 pt-2">
        <div
          className={cn(
            "prose prose-sm max-w-none text-ink",
            "prose-p:my-1 prose-p:text-sm prose-p:leading-relaxed",
            "prose-ul:my-1 prose-li:my-0 prose-li:text-sm",
            "prose-strong:text-ink"
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.bodyMd}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// Conversion HTML simple → markdown : Claude est instruit de n'utiliser que
// <p> <br/> <strong> <em> <ul> <ol> <li> <a>. On évite dangerouslySetInnerHTML
// en passant par ReactMarkdown sur la version markdown rebuilt.
function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/?p[^>]*>/gi, (m) => (m.startsWith("</") ? "\n\n" : ""));
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, "**$2**");
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, "*$2*");
  md = md.replace(/<a\s+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<\/?ul[^>]*>/gi, "\n");
  md = md.replace(/<\/?ol[^>]*>/gi, "\n");
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  // Strip tout autre tag résiduel
  md = md.replace(/<[^>]+>/g, "");
  // Decode entités basiques
  md = md
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return md.trim().replace(/\n{3,}/g, "\n\n");
}

function artifactToPlainText(artifact: ArtifactRow): string {
  if (artifact.type === "patient_email") {
    try {
      const obj = JSON.parse(artifact.content) as { subject?: string; body_html?: string };
      const subject = obj.subject ?? "";
      const body = htmlToMarkdown(obj.body_html ?? "");
      return `Objet : ${subject}\n\n${body}`;
    } catch {
      return artifact.content;
    }
  }
  return artifact.content;
}
