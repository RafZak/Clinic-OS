"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { retryAnalysis } from "@/app/actions/sessions";

export function AnalysisFailed({
  sessionId,
  error,
}: {
  sessionId: string;
  error: string | null;
}) {
  const t = useTranslations("analysisFailed");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retried, setRetried] = useState(false);

  const onRetry = () => {
    startTransition(async () => {
      await retryAnalysis(sessionId);
      setRetried(true);
      setTimeout(() => router.refresh(), 1200);
    });
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 text-destructive" aria-hidden />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-ink">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          {error && (
            <pre className="mt-3 whitespace-pre-wrap rounded-md border border-destructive/20 bg-white/60 px-3 py-2 font-mono text-xs text-destructive">
              {error}
            </pre>
          )}
          <div className="mt-4">
            <Button onClick={onRetry} disabled={pending || retried} size="sm">
              <RefreshCw className="mr-2 size-4" aria-hidden />
              {retried ? t("retried") : pending ? t("sending") : t("retry")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
