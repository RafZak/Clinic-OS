"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Lock, User } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/auth-actions";

const INITIAL: LoginState = {};

export function LoginForm() {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{t("usernameLabel")}</span>
            <span className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 focus-within:border-brand">
              <User className="size-4 text-muted-foreground" aria-hidden />
              <input
                name="username"
                type="text"
                autoComplete="username"
                required
                autoFocus
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
                placeholder={t("usernamePlaceholder")}
              />
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{t("passwordLabel")}</span>
            <span className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 focus-within:border-brand">
              <Lock className="size-4 text-muted-foreground" aria-hidden />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
                placeholder={t("passwordPlaceholder")}
              />
            </span>
          </label>

          {state?.error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {t("errorInvalid")}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t("submitting") : t("submit")}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          {t("demoHint")}
        </p>
      </div>
    </div>
  );
}
