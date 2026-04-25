import "server-only";
import type { Role } from "@/lib/role";
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

export function buildNudges(role: Role, ctx: DashboardContext): Nudge[] {
  return role === "audioprothesiste"
    ? buildPractitionerNudges(ctx)
    : buildAssistantNudges(ctx);
}

function buildPractitionerNudges(ctx: DashboardContext): Nudge[] {
  const nudges: Nudge[] = [];

  if (ctx.uncalledLostPatient) {
    nudges.push({
      id: "uncalled-lost",
      kind: "alert",
      severity: "critical",
      title: `${ctx.uncalledLostPatient.label} pas rappelée depuis ${ctx.uncalledLostPatient.daysSinceContact} j`,
      description:
        "Patiente perdue après objection prix non traitée — un rappel téléphonique permettrait peut-être de relancer le parcours.",
      cta: {
        label: "Voir le parcours",
        href: `/patients/${ctx.uncalledLostPatient.id}`,
      },
    });
  }

  if (ctx.lastConsultation && ctx.lastConsultation.daysAgo <= 1) {
    nudges.push({
      id: "last-consult",
      kind: "alert",
      severity: "info",
      title: `Consultation analysée il y a ${
        ctx.lastConsultation.daysAgo === 0 ? "moins d'1 jour" : "1 jour"
      } — ${ctx.lastConsultation.patientLabel}`,
      description:
        "4 livrables prêts à envoyer (notes cliniques, email, SMS, courrier ORL). La fiche audioprothésiste a été enrichie automatiquement.",
      cta: {
        label: "Voir l'analyse",
        href: `/consultations/${ctx.lastConsultation.id}`,
      },
    });
  }

  if (ctx.lowestStep && ctx.lowestStep.avgScore < 60) {
    nudges.push({
      id: "weak-step",
      kind: "improvement",
      severity: "warning",
      title: `Étape ${ctx.lowestStep.number} sous tension : ${ctx.lowestStep.name}`,
      description: `Score moyen ${ctx.lowestStep.avgScore}/100 sur vos consultations analysées. Revoir le module formation correspondant aiderait à remonter cette étape.`,
      cta: {
        label: `Revoir le module ${ctx.lowestStep.number}`,
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
      title: `Opportunité de montée en gamme — ${ctx.upsellOpportunity.patientLabel}`,
      description: `Essai en classe 1 sur ${ctx.upsellOpportunity.product} alors que le profil correspond à une classe 2. Reproposer un essai comparatif au prochain RDV (potentiel +${delta.toLocaleString("fr-FR")} € panier).`,
      cta: {
        label: "Voir le parcours",
        href: `/patients/${ctx.upsellOpportunity.patientId}`,
      },
    });
  }

  return nudges.slice(0, 4);
}

function buildAssistantNudges(ctx: DashboardContext): Nudge[] {
  const nudges: Nudge[] = [];

  if (ctx.uncalledLostPatient) {
    nudges.push({
      id: "uncalled-lost",
      kind: "alert",
      severity: "critical",
      title: `Relance recommandée — ${ctx.uncalledLostPatient.label}`,
      description: `Patiente perdue depuis ${ctx.uncalledLostPatient.daysSinceContact} j après une objection prix au téléphone. Un rappel en valorisant le 100% santé peut sauver le RDV.`,
      cta: {
        label: "Voir le parcours",
        href: `/patients/${ctx.uncalledLostPatient.id}`,
      },
    });
  }

  if (ctx.appointmentsCount > 0 && ctx.honoredAppointments < ctx.appointmentsCount) {
    const lost = ctx.appointmentsCount - ctx.honoredAppointments;
    nudges.push({
      id: "no-show",
      kind: "alert",
      severity: "warning",
      title: `${lost} RDV pris sans consultation venue à terme`,
      description:
        "Ancrage à renforcer en fin d'appel : répéter date/heure 2× et envoyer SMS de confirmation systématique le matin du RDV.",
    });
  }

  if (ctx.callDurationAvgSec != null && ctx.callDurationAvgSec > 150) {
    const m = Math.floor(ctx.callDurationAvgSec / 60);
    const s = ctx.callDurationAvgSec % 60;
    nudges.push({
      id: "long-calls",
      kind: "improvement",
      severity: "info",
      title: "Durée d'appel au-dessus de la cible",
      description: `Moyenne ${m}m ${s.toString().padStart(2, "0")}s — la cible interne est ≤ 2 min. Revoir le module "Découverte ciblée" pour resserrer cette phase.`,
      cta: {
        label: "Voir le module Découverte",
        href: moduleHrefForStep("phone_call", 4),
      },
    });
  }

  if (ctx.phoneCallsCount > 0) {
    nudges.push({
      id: "objection-prix",
      kind: "improvement",
      severity: "info",
      title: "Pattern récurrent — objection prix au téléphone",
      description:
        "Plusieurs appels perdus avec une objection financière éludée. Le programme \"Convaincre au téléphone\" rappelle qu'au téléphone l'objectif est le triage, pas la vente — l'objection prix se traite en RDV.",
      cta: {
        label: "Voir le programme téléphone",
        href: programHrefBySlug("convaincre-au-telephone"),
      },
    });
  }

  return nudges.slice(0, 4);
}
