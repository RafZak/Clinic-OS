import "server-only";
import { getTranslations } from "next-intl/server";
import type { Role } from "@/lib/role";
import type { Locale } from "@/lib/locale";
import type { DashboardContext } from "@/lib/dashboard";
import {
  moduleHrefForStep,
  programHrefBySlug,
} from "@/lib/learning-links";

export type NudgeSeverity = "info" | "warning" | "critical";
export type NudgeKind = "alert" | "improvement";

export type Nudge = {
  id: string;
  kind: NudgeKind;
  severity: NudgeSeverity;
  title: string;
  description: string;
  cta?: { label: string; href: string };
};

function eurFormat(locale: Locale, n: number): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function buildNudges(
  role: Role,
  ctx: DashboardContext,
  locale: Locale
): Promise<Nudge[]> {
  const t = await getTranslations("nudges");
  return role === "audioprothesiste"
    ? buildPractitionerNudges(ctx, locale, t)
    : buildAssistantNudges(ctx, locale, t);
}

type Trans = (key: string, params?: Record<string, string | number>) => string;

function buildPractitionerNudges(
  ctx: DashboardContext,
  locale: Locale,
  t: Trans
): Nudge[] {
  const nudges: Nudge[] = [];

  if (ctx.uncalledLostPatient) {
    nudges.push({
      id: "uncalled-lost",
      kind: "alert",
      severity: "critical",
      title: t("uncalledLostPro.title", {
        label: ctx.uncalledLostPatient.label,
        days: ctx.uncalledLostPatient.daysSinceContact,
      }),
      description: t("uncalledLostPro.description"),
      cta: {
        label: t("uncalledLostPro.cta"),
        href: `/patients/${ctx.uncalledLostPatient.id}`,
      },
    });
  }

  if (ctx.lastConsultation && ctx.lastConsultation.daysAgo <= 1) {
    nudges.push({
      id: "last-consult",
      kind: "alert",
      severity: "info",
      title:
        ctx.lastConsultation.daysAgo === 0
          ? t("lastConsult.titleZeroDay", {
              label: ctx.lastConsultation.patientLabel,
            })
          : t("lastConsult.titleOneDay", {
              label: ctx.lastConsultation.patientLabel,
            }),
      description: t("lastConsult.description"),
      cta: {
        label: t("lastConsult.cta"),
        href: `/consultations/${ctx.lastConsultation.id}`,
      },
    });
  }

  if (ctx.lowestStep && ctx.lowestStep.avgScore < 60) {
    nudges.push({
      id: "weak-step",
      kind: "improvement",
      severity: "warning",
      title: t("weakStep.title", {
        number: ctx.lowestStep.number,
        name: ctx.lowestStep.name,
      }),
      description: t("weakStep.description", {
        score: ctx.lowestStep.avgScore,
      }),
      cta: {
        label: t("weakStep.cta", { number: ctx.lowestStep.number }),
        href: moduleHrefForStep("consultation", ctx.lowestStep.number),
      },
    });
  }

  if (ctx.upsellOpportunity) {
    const delta = 3200 - ctx.upsellOpportunity.price;
    nudges.push({
      id: "upsell",
      kind: "improvement",
      severity: "info",
      title: t("upsell.title", { label: ctx.upsellOpportunity.patientLabel }),
      description: t("upsell.description", {
        product: ctx.upsellOpportunity.product,
        delta: eurFormat(locale, delta),
      }),
      cta: {
        label: t("upsell.cta"),
        href: `/patients/${ctx.upsellOpportunity.patientId}`,
      },
    });
  }

  return nudges.slice(0, 4);
}

function buildAssistantNudges(
  ctx: DashboardContext,
  _locale: Locale,
  t: Trans
): Nudge[] {
  const nudges: Nudge[] = [];

  if (ctx.uncalledLostPatient) {
    nudges.push({
      id: "uncalled-lost",
      kind: "alert",
      severity: "critical",
      title: t("uncalledLostAssistant.title", {
        label: ctx.uncalledLostPatient.label,
      }),
      description: t("uncalledLostAssistant.description", {
        days: ctx.uncalledLostPatient.daysSinceContact,
      }),
      cta: {
        label: t("uncalledLostAssistant.cta"),
        href: `/patients/${ctx.uncalledLostPatient.id}`,
      },
    });
  }

  if (
    ctx.appointmentsCount > 0 &&
    ctx.honoredAppointments < ctx.appointmentsCount
  ) {
    const lost = ctx.appointmentsCount - ctx.honoredAppointments;
    nudges.push({
      id: "no-show",
      kind: "alert",
      severity: "warning",
      title: t("noShow.title", { count: lost }),
      description: t("noShow.description"),
    });
  }

  if (ctx.callDurationAvgSec != null && ctx.callDurationAvgSec > 150) {
    const m = Math.floor(ctx.callDurationAvgSec / 60);
    const s = ctx.callDurationAvgSec % 60;
    nudges.push({
      id: "long-calls",
      kind: "improvement",
      severity: "info",
      title: t("longCalls.title"),
      description: t("longCalls.description", {
        m,
        s: s.toString().padStart(2, "0"),
      }),
      cta: {
        label: t("longCalls.cta"),
        href: moduleHrefForStep("phone_call", 4),
      },
    });
  }

  if (ctx.phoneCallsCount > 0) {
    nudges.push({
      id: "objection-prix",
      kind: "improvement",
      severity: "info",
      title: t("objectionPrix.title"),
      description: t("objectionPrix.description"),
      cta: {
        label: t("objectionPrix.cta"),
        href: programHrefBySlug("convaincre-au-telephone"),
      },
    });
  }

  return nudges.slice(0, 4);
}
