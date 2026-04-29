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

export type NudgeBundle = {
  nudges: Nudge[];
  hiddenCount: number;
};

const SEVERITY_RANK: Record<NudgeSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const MAX_DISPLAYED = 5;

function sortAndCap(all: Nudge[]): NudgeBundle {
  const sorted = [...all].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );
  if (sorted.length <= MAX_DISPLAYED) {
    return { nudges: sorted, hiddenCount: 0 };
  }
  return {
    nudges: sorted.slice(0, MAX_DISPLAYED),
    hiddenCount: sorted.length - MAX_DISPLAYED,
  };
}

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
): Promise<NudgeBundle> {
  const t = await getTranslations("nudges");
  const all =
    role === "audioprothesiste"
      ? buildPractitionerNudges(ctx, locale, t)
      : buildAssistantNudges(ctx, locale, t);
  return sortAndCap(all);
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

  if (ctx.lowScoreToDebrief) {
    nudges.push({
      id: "low-score-debrief",
      kind: "alert",
      severity: "critical",
      title: t("lowScoreDebrief.title", {
        label: ctx.lowScoreToDebrief.patientLabel,
        score: ctx.lowScoreToDebrief.score,
      }),
      description: t("lowScoreDebrief.description"),
      cta: {
        label: t("lowScoreDebrief.cta"),
        href: `/consultations/${ctx.lowScoreToDebrief.sessionId}`,
      },
    });
  }

  if (ctx.trialInProgress) {
    nudges.push({
      id: "trial-in-progress",
      kind: "alert",
      severity: "warning",
      title: t("trialInProgress.title", {
        label: ctx.trialInProgress.patientLabel,
        days: ctx.trialInProgress.daysSinceTrial,
      }),
      description: ctx.trialInProgress.product
        ? t("trialInProgress.descriptionWithProduct", {
            product: ctx.trialInProgress.product,
          })
        : t("trialInProgress.description"),
      cta: {
        label: t("trialInProgress.cta"),
        href: `/patients/${ctx.trialInProgress.patientId}`,
      },
    });
  }

  if (ctx.prospectToFollowUp) {
    nudges.push({
      id: "prospect-follow-up",
      kind: "alert",
      severity: "warning",
      title: t("prospectFollowUp.title", {
        label: ctx.prospectToFollowUp.patientLabel,
        days: ctx.prospectToFollowUp.daysSinceConsult,
      }),
      description: t("prospectFollowUp.description"),
      cta: {
        label: t("prospectFollowUp.cta"),
        href: `/patients/${ctx.prospectToFollowUp.patientId}`,
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

  return nudges;
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

  return nudges;
}
