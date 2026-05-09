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
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  regenerateAllArtifacts,
  regenerateArtifact,
} from "@/app/actions/artifacts";
import type { ArtifactRow, ArtifactType } from "@/lib/types/analysis";

type ArtifactDef = {
  type: ArtifactType;
  icon: typeof FileText;
  supportsPsyProfile: boolean;
};

const ARTIFACT_DEFS: ArtifactDef[] = [
  { type: "clinical_notes", icon: Stethoscope, supportsPsyProfile: false },
  { type: "patient_email", icon: Mail, supportsPsyProfile: true },
  { type: "patient_sms", icon: MessageSquare, supportsPsyProfile: true },
  { type: "orl_letter", icon: FileText, supportsPsyProfile: false },
];

export function ArtifactsPanel({
  sessionId,
  artifacts,
  analysisDone,
  hasPsyProfile = false,
}: {
  sessionId: string;
  artifacts: ArtifactRow[];
  analysisDone: boolean;
  hasPsyProfile?: boolean;
}) {
  const t = useTranslations("artifacts");
  const router = useRouter();
  const byType = useMemo(() => new Map(artifacts.map((a) => [a.type, a])), [artifacts]);
  const okCount = artifacts.length;
  const allReady = okCount === ARTIFACT_DEFS.length;

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
        <h3 className="mt-3 text-sm font-medium text-ink">{t("preparingTitle")}</h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          {t("preparingDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("title")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {allReady
              ? t("subtitleAllReady")
              : t("subtitleProgress", { ok: okCount, total: ARTIFACT_DEFS.length })}
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
          {t("regenerateAll")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ARTIFACT_DEFS.map((def) => (
          <ArtifactCard
            key={def.type}
            sessionId={sessionId}
            def={def}
            artifact={byType.get(def.type) ?? null}
            hasPsyProfile={hasPsyProfile}
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
  hasPsyProfile,
}: {
  sessionId: string;
  def: ArtifactDef;
  artifact: ArtifactRow | null;
  hasPsyProfile: boolean;
}) {
  const t = useTranslations("artifacts");
  const Icon = def.icon;
  const router = useRouter();
  const [isRegenerating, startRegenerate] = useTransition();
  const [isRegeneratingPsy, startRegeneratePsy] = useTransition();
  const [copied, setCopied] = useState(false);

  const usedPsyProfile = useMemo(() => {
    if (!artifact?.metadata) return false;
    const meta = artifact.metadata as Record<string, unknown>;
    return meta.usedPsyProfile === true;
  }, [artifact]);

  const onCopy = async () => {
    if (!artifact) return;
    const plain = artifactToPlainText(artifact, t("subjectPrefix"));
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

  const onRegenerateWithPsy = () =>
    startRegeneratePsy(async () => {
      await regenerateArtifact(sessionId, def.type, { usePsyProfile: true });
      setTimeout(() => router.refresh(), 1500);
    });

  const showPsyButton = def.supportsPsyProfile && hasPsyProfile;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-brand" aria-hidden />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-ink">{t(def.type)}</h4>
              {usedPsyProfile && (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/[0.05] px-2 py-0.5 text-[10px] font-medium text-brand">
                  <Sparkles className="size-3" aria-hidden />
                  {t("adaptedToProfile")}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("destination", { destination: t(`destinations.${def.type}`) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
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
            {copied ? t("copied") : t("copy")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating || isRegeneratingPsy}
            className="h-7 px-2 text-xs"
          >
            {isRegenerating ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {t("regenerate")}
          </Button>
          {showPsyButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateWithPsy}
              disabled={isRegenerating || isRegeneratingPsy}
              className="h-7 border-brand/40 px-2 text-xs text-brand hover:bg-brand/[0.05]"
            >
              {isRegeneratingPsy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3.5" aria-hidden />
              )}
              {t("regenerateWithPsy")}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border/60 bg-light/40 px-3 py-3">
        {!artifact ? (
          <ArtifactSkeleton />
        ) : (
          <ArtifactContent type={def.type} content={artifact.content} />
        )}
      </div>
    </div>
  );
}

function ArtifactSkeleton() {
  const t = useTranslations("artifacts");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t("generating")}
      </div>
      <div className="h-2 w-3/4 animate-pulse rounded bg-surface-muted" />
      <div className="h-2 w-2/3 animate-pulse rounded bg-surface-muted" />
      <div className="h-2 w-4/5 animate-pulse rounded bg-surface-muted" />
    </div>
  );
}

function ArtifactContent({ type, content }: { type: ArtifactType; content: string }) {
  const t = useTranslations("artifacts");
  if (type === "patient_email") {
    return <EmailRenderer content={content} />;
  }
  if (type === "patient_sms") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {t("smsCharacters", { count: content.length })}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm text-ink">{content}</p>
      </div>
    );
  }
  if (type === "clinical_notes") {
    return (
      <div
        className={cn(
          "prose prose-sm max-w-none text-ink",
          "prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-ink prose-headings:font-semibold",
          "prose-h2:mt-5 prose-h2:pt-3 prose-h2:text-[13px] prose-h2:uppercase prose-h2:tracking-wide prose-h2:text-brand prose-h2:border-t prose-h2:border-brand/20 first-of-type:[&_h2]:mt-0 first-of-type:[&_h2]:border-t-0 first-of-type:[&_h2]:pt-0",
          "prose-h3:text-xs prose-h3:uppercase prose-h3:tracking-wide prose-h3:text-muted-foreground",
          "prose-p:my-1.5 prose-p:text-sm prose-p:leading-relaxed",
          "prose-ul:my-2 prose-li:my-0.5 prose-li:text-sm prose-li:leading-relaxed",
          "prose-strong:text-ink"
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
  const t = useTranslations("artifacts");
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
    return <p className="text-xs text-muted-foreground">{t("emailInvalid")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("subjectLabel")}
        </span>
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
  md = md.replace(/<[^>]+>/g, "");
  md = md
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return md.trim().replace(/\n{3,}/g, "\n\n");
}

function artifactToPlainText(artifact: ArtifactRow, subjectPrefix: string): string {
  if (artifact.type === "patient_email") {
    try {
      const obj = JSON.parse(artifact.content) as { subject?: string; body_html?: string };
      const subject = obj.subject ?? "";
      const body = htmlToMarkdown(obj.body_html ?? "");
      return `${subjectPrefix}${subject}\n\n${body}`;
    } catch {
      return artifact.content;
    }
  }
  return artifact.content;
}
