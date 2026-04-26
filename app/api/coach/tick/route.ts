import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { getAnthropic, CLAUDE_MODELS } from "@/lib/claude";
import { getFramework, getStepName, getStepDescription } from "@/lib/frameworks";
import { readSessionLocale } from "@/lib/sessions";
import { getLocaleInstruction, getSpeakerLabels } from "@/lib/i18n/llm";

export const runtime = "nodejs";
export const maxDuration = 20;

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  frameworkKind: z.enum(["consultation", "phone_call"]),
  lines: z.array(
    z.object({
      speaker: z.enum(["practitioner", "patient"]),
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().nonnegative(),
      text: z.string().min(1),
    })
  ),
  excludeRelatedSteps: z.array(z.number().int()).optional(),
});

const INSIGHT_TOOL = {
  name: "emit_bubble",
  description:
    "Emit a single coaching bubble if the recent excerpt contains a clear coaching moment, or skip if nothing warrants one.",
  input_schema: {
    type: "object" as const,
    properties: {
      decision: { type: "string", enum: ["emit", "skip"] },
      insight: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "missed_objection",
              "upsell_missed",
              "good_practice",
              "improvement",
            ],
          },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          title: { type: "string", maxLength: 80 },
          description: { type: "string", maxLength: 280 },
          timestamp_ms: { type: ["number", "null"] },
          related_step: { type: ["number", "null"] },
        },
        required: [
          "type",
          "severity",
          "title",
          "description",
          "timestamp_ms",
          "related_step",
        ],
      },
    },
    required: ["decision"],
  },
};

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { sessionId, frameworkKind, lines, excludeRelatedSteps = [] } = parsed.data;
  if (lines.length < 3) {
    return NextResponse.json({ insight: null });
  }

  const sessionRow = await db
    .select({ metadata: sessions.metadata })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const locale = readSessionLocale(sessionRow[0]?.metadata);

  const steps = getFramework(frameworkKind);
  const frameworkDescription = steps
    .map(
      (s) =>
        `${s.number}. ${getStepName(s, locale)} — ${getStepDescription(s, locale)}`
    )
    .join("\n");

  const labels = getSpeakerLabels(frameworkKind, locale);
  const transcript = lines
    .map(
      (l) =>
        `[${formatMs(l.startMs)}] ${
          l.speaker === "practitioner" ? labels.pro : labels.patient
        }: ${l.text}`
    )
    .join("\n");

  const excludeLine =
    excludeRelatedSteps.length > 0
      ? locale === "en"
        ? `\n\nDo NOT re-emit a bubble on steps already covered earlier in this appointment: ${excludeRelatedSteps.join(", ")}.`
        : `\n\nNe re-générez PAS de bulle sur les étapes déjà couvertes dans ce rendez-vous : ${excludeRelatedSteps.join(", ")}.`
      : "";

  const localeInstruction = getLocaleInstruction(locale);

  const systemPrompt = `${localeInstruction}

Vous êtes un coach ambiant pour audioprothésiste en consultation, ancré marché français (classe 1 / classe 2, reste à charge, 100% santé, ordonnance ORL, mutuelle). Vous observez en direct un extrait récent (environ les 60 dernières secondes) et devez détecter UN seul moment coachable dans cet extrait précis — objection mal accueillie, opportunité d'upsell manquée, bonne pratique à renforcer, ou axe d'amélioration actionnable. Si aucun moment clair ne le mérite, répondez "skip".

Ton : professionnel, factuel, bienveillant sans complaisance. Vouvoyez l'utilisateur (l'audioprothésiste). Coachez l'utilisateur, jamais le patient. Soyez spécifique : citez un terme concret du dialogue si pertinent. 280 caractères max sur la description.

Severity :
- critical : faute qui coûte la vente ou le client
- warning : occasion manquée, à corriger la prochaine fois
- info : bonne pratique à consolider, ou remarque pédagogique

timestamp_ms : si la bulle porte sur un moment précis, mettre le startMs de la ligne concernée, sinon null.
related_step : numéro de l'étape framework si applicable (1-10 consultation, 1-6 appel), sinon null.${excludeLine}

Framework de référence :
${frameworkDescription}`;

  const anthropic = getAnthropic();
  const res = await anthropic.messages.create({
    model: CLAUDE_MODELS.haiku,
    max_tokens: 512,
    system: systemPrompt,
    tools: [INSIGHT_TOOL],
    tool_choice: { type: "tool", name: "emit_bubble" },
    messages: [
      {
        role: "user",
        content:
          locale === "en"
            ? `Recent excerpt:\n\n${transcript}`
            : `Extrait récent :\n\n${transcript}`,
      },
    ],
  });

  const toolUse = res.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ insight: null });
  }
  const input = toolUse.input as {
    decision: "emit" | "skip";
    insight?: {
      type: string;
      severity: string;
      title: string;
      description: string;
      timestamp_ms: number | null;
      related_step: number | null;
    };
  };
  if (input.decision === "skip" || !input.insight) {
    return NextResponse.json({ insight: null });
  }

  return NextResponse.json({ insight: input.insight });
}
