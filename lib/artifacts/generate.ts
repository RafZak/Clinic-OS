import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  patients,
  practitioners,
  centers,
  transcriptLines,
  sessionScores,
  coachingInsights,
  sessionArtifacts,
  vaultPages,
} from "@/db/schema";
import { getAnthropic, CLAUDE_MODELS } from "@/lib/claude";

export type ArtifactType =
  | "clinical_notes"
  | "patient_email"
  | "patient_sms"
  | "orl_letter";

const ALL_TYPES: ArtifactType[] = [
  "clinical_notes",
  "patient_email",
  "patient_sms",
  "orl_letter",
];

export type ArtifactGenerationResult =
  | { ok: true; type: ArtifactType; durationMs: number }
  | { ok: false; type: ArtifactType; error: string; durationMs: number };

type Context = {
  sessionId: string;
  sessionKind: string;
  startedAt: Date | null;
  durationSeconds: number | null;
  patientLabel: string | null;
  patientAge: number | null;
  practitionerName: string | null;
  centerName: string | null;
  centerCity: string | null;
  transcript: { speaker: string; ts: string; text: string }[];
  scores: { stepNumber: number; stepName: string; score: number | null; rationale: string | null }[];
  insights: {
    type: string;
    severity: string | null;
    title: string;
    description: string;
    relatedStep: number | null;
    estimatedImpactEur: number | null;
  }[];
  practitionerVaultMd: string | null;
  globalScore: number | null;
  summary: string | null;
};

async function loadContext(sessionId: string): Promise<Context | null> {
  const rows = await db
    .select()
    .from(sessions)
    .leftJoin(patients, eq(sessions.patientId, patients.id))
    .leftJoin(practitioners, eq(sessions.practitionerId, practitioners.id))
    .leftJoin(centers, eq(practitioners.centerId, centers.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (rows.length === 0) return null;
  const { sessions: s, patients: p, practitioners: pr, centers: c } = rows[0];

  const [linesRaw, scoresRaw, insightsRaw, vaultRaw] = await Promise.all([
    db
      .select()
      .from(transcriptLines)
      .where(eq(transcriptLines.sessionId, sessionId))
      .orderBy(asc(transcriptLines.startMs)),
    db
      .select()
      .from(sessionScores)
      .where(eq(sessionScores.sessionId, sessionId))
      .orderBy(asc(sessionScores.stepNumber)),
    db
      .select()
      .from(coachingInsights)
      .where(eq(coachingInsights.sessionId, sessionId)),
    pr
      ? db
          .select()
          .from(vaultPages)
          .where(and(eq(vaultPages.kind, "practitioner"), eq(vaultPages.entityId, pr.id)))
          .limit(1)
      : Promise.resolve([] as (typeof vaultPages.$inferSelect)[]),
  ]);

  return {
    sessionId,
    sessionKind: s.kind,
    startedAt: s.startedAt ?? null,
    durationSeconds: s.durationSeconds ?? null,
    patientLabel: p?.label ?? null,
    patientAge: p?.age ?? null,
    practitionerName: pr?.fullName ?? null,
    centerName: c?.name ?? null,
    centerCity: c?.city ?? null,
    transcript: linesRaw.map((l) => ({
      speaker: l.speaker === "practitioner" ? "Pro" : "Patient",
      ts: formatTs(l.startMs),
      text: l.text,
    })),
    scores: scoresRaw.map((s) => ({
      stepNumber: s.stepNumber,
      stepName: s.stepName,
      score: s.score,
      rationale: s.rationale,
    })),
    insights: insightsRaw.map((i) => ({
      type: i.type,
      severity: i.severity,
      title: i.title,
      description: i.description,
      relatedStep: i.relatedStep,
      estimatedImpactEur: i.estimatedImpactEur,
    })),
    practitionerVaultMd: vaultRaw[0]?.contentMd ?? null,
    globalScore: s.globalScore,
    summary: s.summary,
  };
}

function formatTs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTranscript(ctx: Context): string {
  return ctx.transcript.map((l) => `[${l.ts}] ${l.speaker}: ${l.text}`).join("\n");
}

function formatScores(ctx: Context): string {
  return ctx.scores
    .map(
      (s) =>
        `${s.stepNumber}. ${s.stepName} — ${s.score === null ? "non évalué" : `${s.score}/100`}${
          s.rationale ? ` — ${s.rationale}` : ""
        }`
    )
    .join("\n");
}

function formatInsights(ctx: Context): string {
  return ctx.insights
    .map(
      (i) =>
        `- [${i.severity ?? "info"}] ${i.title} — ${i.description}${
          i.estimatedImpactEur ? ` (impact estimé ${i.estimatedImpactEur} €)` : ""
        }`
    )
    .join("\n");
}

function patientHeader(ctx: Context): string {
  if (!ctx.patientLabel) return "Patient : non renseigné";
  return `Patient : ${ctx.patientLabel}${ctx.patientAge ? ` (${ctx.patientAge} ans)` : ""}`;
}

function practitionerHeader(ctx: Context): string {
  const name = ctx.practitionerName ?? "Audioprothésiste";
  const center = ctx.centerName ? ` — ${ctx.centerName}` : "";
  const city = ctx.centerCity ? ` (${ctx.centerCity})` : "";
  return `Audioprothésiste : ${name}${center}${city}`;
}

function vaultBlock(ctx: Context): string {
  if (!ctx.practitionerVaultMd) {
    return "Fiche organisationnelle de l'audioprothésiste : non disponible.";
  }
  return `Fiche organisationnelle de l'audioprothésiste (extraits) :\n\n${ctx.practitionerVaultMd.slice(0, 1800)}`;
}

async function persistArtifact(
  sessionId: string,
  type: ArtifactType,
  content: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(sessionArtifacts)
      .where(and(eq(sessionArtifacts.sessionId, sessionId), eq(sessionArtifacts.type, type)));
    await tx.insert(sessionArtifacts).values({
      sessionId,
      type,
      content,
      metadata,
    });
  });
}

export async function generateClinicalNotes(ctx: Context): Promise<{ ok: true; durationMs: number }> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const system = `Tu rédiges les notes cliniques d'une consultation d'audioprothèse à partir du transcript et de l'analyse IA. Ces notes servent au dossier patient.

RÈGLES :
- Format markdown structuré avec sections imposées :
  ## Motif de consultation
  ## Antécédents évoqués
  ## Audiogramme évoqué
  ## Options présentées
  ## Décisions prises
  ## Prochaines étapes
- Ton clinique factuel, sans jugement, sans qualificatif émotionnel.
- Vouvoiement systématique. Désigne le patient par "Mme/M. <Nom>".
- Pas d'invention : si une info n'est pas dans le transcript, écris "Non renseigné" sous la section concernée.
- 200-400 mots maximum.
- Ne mentionne JAMAIS le score, les insights, ou un avis sur la prestation du pro — c'est un dossier patient, pas un coaching.
- Si la fiche organisationnelle indique un point d'attention récurrent, tu peux nuancer une formulation sans le citer explicitement.`;

  const user = `${patientHeader(ctx)}
${practitionerHeader(ctx)}
Date de session : ${ctx.startedAt ? ctx.startedAt.toISOString().slice(0, 10) : "non renseignée"}
Durée : ${ctx.durationSeconds ?? "?"} s

Transcript verbatim :
${formatTranscript(ctx)}

${vaultBlock(ctx)}

Génère les notes cliniques en appelant l'outil submit_clinical_notes.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 2000,
    system,
    tools: [
      {
        name: "submit_clinical_notes",
        description: "Soumet les notes cliniques structurées.",
        input_schema: {
          type: "object",
          properties: {
            markdown: { type: "string", minLength: 100 },
          },
          required: ["markdown"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_clinical_notes" },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas invoqué submit_clinical_notes");
  }
  const input = toolUse.input as { markdown: string };
  const markdown = String(input.markdown ?? "").slice(0, 4000);

  await persistArtifact(ctx.sessionId, "clinical_notes", markdown, {
    model: CLAUDE_MODELS.sonnet,
    durationMs: Date.now() - t0,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return { ok: true, durationMs: Date.now() - t0 };
}

export async function generatePatientEmail(
  ctx: Context
): Promise<{ ok: true; durationMs: number }> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const system = `Tu rédiges un email de suivi à envoyer au patient après sa session.

RÈGLES :
- Format : objet (court, factuel, sans emojis) + corps en HTML simple (<p>, <ul><li>, <strong>, <br/>). Pas de CSS, pas d'images, pas d'iframes.
- Ton chaleureux mais professionnel. Vouvoiement.
- Adresse-toi au patient par "Madame <Nom>" ou "Monsieur <Nom>" selon le label.
- Reprends 1-2 engagements concrets pris pendant la session (extraits du transcript).
- Termine par UN CTA contextuel unique (confirmer un essai, finaliser un devis, prendre RDV de suivi, transmettre une ordonnance).
- Pas d'invention : ne mentionne aucun produit, prix ou date qui n'est pas dans le transcript.
- Signature : "Bien cordialement,<br/><strong>{practitioner}</strong><br/>{center}". Utiliser "—" si une info manque.
- 100-200 mots dans le corps. Pas d'emojis.`;

  const user = `${patientHeader(ctx)}
${practitionerHeader(ctx)}
Date de session : ${ctx.startedAt ? ctx.startedAt.toISOString().slice(0, 10) : "non renseignée"}

Transcript verbatim :
${formatTranscript(ctx)}

Synthèse analyste : ${ctx.summary ?? "—"}

${vaultBlock(ctx)}

Rédige l'email patient en appelant l'outil submit_patient_email.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 1500,
    system,
    tools: [
      {
        name: "submit_patient_email",
        description: "Soumet l'email patient (objet + corps HTML).",
        input_schema: {
          type: "object",
          properties: {
            subject: { type: "string", maxLength: 120 },
            body_html: { type: "string", minLength: 150 },
          },
          required: ["subject", "body_html"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_patient_email" },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas invoqué submit_patient_email");
  }
  const input = toolUse.input as { subject: string; body_html: string };
  const subject = String(input.subject ?? "").slice(0, 200);
  const bodyHtml = String(input.body_html ?? "").slice(0, 4000);

  const content = JSON.stringify({ subject, body_html: bodyHtml });

  await persistArtifact(ctx.sessionId, "patient_email", content, {
    model: CLAUDE_MODELS.sonnet,
    durationMs: Date.now() - t0,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return { ok: true, durationMs: Date.now() - t0 };
}

export async function generatePatientSms(
  ctx: Context
): Promise<{ ok: true; durationMs: number }> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const system = `Tu rédiges un SMS court de rappel ou de confirmation à envoyer au patient après sa session.

RÈGLES STRICTES :
- 140 caractères MAXIMUM, espaces inclus.
- Direct, factuel, vouvoiement.
- Une seule info principale (RDV, action à faire, confirmation).
- Pas d'emoji, pas de lien, pas d'abréviations agressives ("rdv" OK, "à+" non).
- Adresse : "Mme <Nom>" ou "M. <Nom>".
- Termine par "Centre <ville>" ou nom du centre.

Exemple cible (ne pas copier littéralement) :
"Bonjour Mme Durand, votre essai d'appareillage est prévu le 28/03 à 14h au centre Lyon 3. À très vite. Centre Audio Lyon 3."`;

  const user = `${patientHeader(ctx)}
${practitionerHeader(ctx)}

Synthèse analyste : ${ctx.summary ?? "—"}

Insights principaux (pour identifier la prochaine action) :
${formatInsights(ctx).slice(0, 600) || "Aucun insight."}

Transcript verbatim (extraits) :
${formatTranscript(ctx).slice(0, 3000)}

Rédige le SMS en appelant l'outil submit_patient_sms.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.haiku,
    max_tokens: 400,
    system,
    tools: [
      {
        name: "submit_patient_sms",
        description: "Soumet le SMS patient.",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string", maxLength: 160 },
          },
          required: ["text"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_patient_sms" },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas invoqué submit_patient_sms");
  }
  const raw = String((toolUse.input as { text: string }).text ?? "").trim();
  const text = raw.length > 140 ? raw.slice(0, 137) + "..." : raw;

  await persistArtifact(ctx.sessionId, "patient_sms", text, {
    model: CLAUDE_MODELS.haiku,
    durationMs: Date.now() - t0,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    truncated: raw.length > 140,
  });

  return { ok: true, durationMs: Date.now() - t0 };
}

export async function generateOrlLetter(
  ctx: Context
): Promise<{ ok: true; durationMs: number }> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const system = `Tu rédiges un courrier médical concis destiné au médecin ORL prescripteur, à partir d'une consultation d'audioprothèse.

RÈGLES :
- Format : courrier médical professionnel français, en markdown qui se prête à la conversion PDF.
- Structure imposée, minimale :
  - En-tête expéditeur (audioprothésiste + centre + ville)
  - Date du courrier (date de session)
  - Destinataire ("À l'attention du Docteur ___" si nom non mentionné, sinon utiliser le nom du transcript)
  - Objet (une ligne)
  - Formule d'introduction ("Cher Confrère, Chère Consœur,")
  - Corps : 2 paragraphes courts maximum — (1) motif + audiogramme évoqué, (2) solution retenue + calendrier essai/suivi.
  - Formule de politesse classique (une ligne)
  - Signature : nom + "Audioprothésiste D.E."
- Vocabulaire médical correct : presbyacousie, perte de transmission, perception, classe 1, classe 2, audiométrie tonale/vocale, gain prothétique, etc.
- 120-180 mots pour le corps (hors en-tête, destinataire, objet, formules et signature). Phrases courtes, directes.
- Pas d'invention de chiffres précis (gains en dB, courbes audiométriques) qui ne seraient pas dans le transcript. Mentionner "audiogramme à transmettre par retour de courrier" si non chiffrable.`;

  const user = `${patientHeader(ctx)}
${practitionerHeader(ctx)}
Date de session : ${ctx.startedAt ? ctx.startedAt.toISOString().slice(0, 10) : "non renseignée"}

Transcript verbatim :
${formatTranscript(ctx)}

Synthèse analyste : ${ctx.summary ?? "—"}

Rédige le courrier ORL en appelant l'outil submit_orl_letter.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 2500,
    system,
    tools: [
      {
        name: "submit_orl_letter",
        description: "Soumet le courrier ORL en markdown.",
        input_schema: {
          type: "object",
          properties: {
            markdown: { type: "string", minLength: 200 },
          },
          required: ["markdown"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_orl_letter" },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas invoqué submit_orl_letter");
  }
  const markdown = String((toolUse.input as { markdown: string }).markdown ?? "").slice(0, 5000);

  await persistArtifact(ctx.sessionId, "orl_letter", markdown, {
    model: CLAUDE_MODELS.sonnet,
    durationMs: Date.now() - t0,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return { ok: true, durationMs: Date.now() - t0 };
}

const GENERATORS: Record<ArtifactType, (ctx: Context) => Promise<{ ok: true; durationMs: number }>> = {
  clinical_notes: generateClinicalNotes,
  patient_email: generatePatientEmail,
  patient_sms: generatePatientSms,
  orl_letter: generateOrlLetter,
};

export async function generateOneArtifact(
  sessionId: string,
  type: ArtifactType
): Promise<ArtifactGenerationResult> {
  const t0 = Date.now();
  const ctx = await loadContext(sessionId);
  if (!ctx) {
    return { ok: false, type, error: "session introuvable", durationMs: Date.now() - t0 };
  }
  if (ctx.transcript.length === 0) {
    return { ok: false, type, error: "transcript vide", durationMs: Date.now() - t0 };
  }
  try {
    const r = await GENERATORS[type](ctx);
    log(sessionId, type, "ok", r.durationMs);
    return { ok: true, type, durationMs: r.durationMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(sessionId, type, "failed", Date.now() - t0, { error: msg });
    return { ok: false, type, error: msg, durationMs: Date.now() - t0 };
  }
}

export async function generateAllArtifacts(
  sessionId: string
): Promise<ArtifactGenerationResult[]> {
  const ctx = await loadContext(sessionId);
  if (!ctx) {
    return ALL_TYPES.map((type) => ({
      ok: false as const,
      type,
      error: "session introuvable",
      durationMs: 0,
    }));
  }
  if (ctx.transcript.length === 0) {
    return ALL_TYPES.map((type) => ({
      ok: false as const,
      type,
      error: "transcript vide",
      durationMs: 0,
    }));
  }

  const t0 = Date.now();
  const results = await Promise.all(
    ALL_TYPES.map(async (type): Promise<ArtifactGenerationResult> => {
      const tStart = Date.now();
      try {
        const r = await GENERATORS[type](ctx);
        log(sessionId, type, "ok", r.durationMs);
        return { ok: true, type, durationMs: r.durationMs };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(sessionId, type, "failed", Date.now() - tStart, { error: msg });
        return { ok: false, type, error: msg, durationMs: Date.now() - tStart };
      }
    })
  );
  log(sessionId, "all_artifacts", "done", Date.now() - t0, {
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
  return results;
}

function log(
  sessionId: string,
  step: string,
  status: string,
  durationMs: number,
  extra: Record<string, unknown> = {}
) {
  console.log(
    JSON.stringify({ tag: "artifacts", sessionId, step, status, durationMs, ...extra })
  );
}
