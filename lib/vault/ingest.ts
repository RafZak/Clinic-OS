import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessions,
  patients,
  practitioners,
  centers,
  transcriptLines,
  sessionScores,
  coachingInsights,
  vaultPages,
} from "@/db/schema";
import { getAnthropic, CLAUDE_MODELS } from "@/lib/claude";
import { readSessionLocale } from "@/lib/sessions";
import type { Locale } from "@/lib/locale";
import { getLocaleInstruction, getSpeakerLabels } from "@/lib/i18n/llm";
import { isStepScorable, type FrameworkKind } from "@/lib/frameworks";
import {
  parseFrontmatter,
  serializeFrontmatter,
  mergeMetadata,
  type VaultMetadata,
} from "@/lib/vault/frontmatter";
import { extractWikilinks } from "@/lib/vault/wikilinks";
import {
  writeVaultFile,
  readVaultFile,
  ensureVaultBucket,
} from "@/lib/vault/storage";

export type VaultIngestResult =
  | { ok: true; patches: number; durationMs: number }
  | { ok: false; error: string; durationMs: number };

type Patch = {
  path: string;
  operation: "create" | "replace" | "append_section";
  section_heading?: string | null;
  content_md: string;
  metadata_diff?: Partial<VaultMetadata> | null;
};

type RawPatchResponse = {
  patches: Patch[];
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function updateVaultForSession(
  sessionId: string
): Promise<VaultIngestResult> {
  const t0 = Date.now();
  try {
    await ensureVaultBucket();

    // 1) Charger contexte session
    const sessionRow = await loadSessionContext(sessionId);
    if (!sessionRow) {
      return { ok: false, error: "session introuvable", durationMs: Date.now() - t0 };
    }
    if (sessionRow.scores.length === 0 && sessionRow.insights.length === 0) {
      return {
        ok: false,
        error: "analyse non disponible (pas de scores ni d'insights)",
        durationMs: Date.now() - t0,
      };
    }

    // 2) Charger fiches existantes concernées
    const existingPages = await loadRelevantPages(sessionRow);

    // 3) Préparer prompt + appel Claude
    const patches = await callClaudeForPatches(sessionRow, existingPages);

    // 4) Garantir une fiche session
    const sessionPath = `sessions/${sessionId.slice(0, 8)}.md`;
    if (!patches.some((p) => p.path === sessionPath)) {
      patches.push(buildSessionFallback(sessionPath, sessionRow));
    }

    // 5) Appliquer les patches
    let applied = 0;
    const failures: { path: string; operation: string; error: string }[] = [];
    for (const patch of patches) {
      try {
        await applyPatch(patch, sessionRow);
        applied += 1;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        failures.push({
          path: patch.path,
          operation: patch.operation,
          error: errorMsg,
        });
        console.warn(
          JSON.stringify({
            tag: "vault_patch_failed",
            sessionId,
            path: patch.path,
            operation: patch.operation,
            section_heading: patch.section_heading ?? null,
            content_preview: patch.content_md.slice(0, 200),
            error: errorMsg,
            stack: stack?.split("\n").slice(0, 4).join(" | "),
          })
        );
      }
    }
    if (failures.length > 0) {
      log(sessionId, "vault_ingest", "partial", Date.now() - t0, {
        patches: applied,
        total: patches.length,
        failures,
      });
    }

    log(sessionId, "vault_ingest", "ok", Date.now() - t0, {
      patches: applied,
      total: patches.length,
    });
    return { ok: true, patches: applied, durationMs: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(sessionId, "vault_ingest", "failed", Date.now() - t0, { error: msg });
    return { ok: false, error: msg, durationMs: Date.now() - t0 };
  }
}

type SessionContext = {
  sessionId: string;
  sessionShort: string;
  kind: string;
  locale: Locale;
  durationSeconds: number | null;
  startedAt: Date | null;
  globalScore: number | null;
  summary: string | null;
  practitionerId: string | null;
  practitionerName: string | null;
  practitionerSlug: string | null;
  centerId: string | null;
  centerName: string | null;
  centerSlug: string | null;
  patientId: string | null;
  patientLabel: string | null;
  patientSlug: string | null;
  transcriptPreview: string;
  scores: { stepNumber: number; stepName: string; score: number | null; rationale: string | null }[];
  insights: {
    type: string;
    severity: string | null;
    title: string;
    description: string;
    relatedStep: number | null;
    estimatedImpactEur: number | null;
  }[];
};

async function loadSessionContext(sessionId: string): Promise<SessionContext | null> {
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

  const [linesRaw, scoresRaw, insightsRaw] = await Promise.all([
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
  ]);

  const locale = readSessionLocale(s.metadata);
  const kind = (s.kind === "phone_call" ? "phone_call" : "consultation") as FrameworkKind;
  const labels = getSpeakerLabels(kind, locale);

  const transcriptText = linesRaw
    .slice(0, 60)
    .map((l) => {
      const ts = formatTs(l.startMs);
      const who = l.speaker === "practitioner" ? labels.pro : labels.patient;
      return `[${ts}] ${who}: ${l.text}`;
    })
    .join("\n");

  return {
    sessionId,
    sessionShort: sessionId.slice(0, 8),
    kind: s.kind,
    locale,
    durationSeconds: s.durationSeconds ?? null,
    startedAt: s.startedAt ?? null,
    globalScore: s.globalScore,
    summary: s.summary,
    practitionerId: pr?.id ?? null,
    practitionerName: pr?.fullName ?? null,
    practitionerSlug: pr ? slugify(pr.fullName) : null,
    centerId: c?.id ?? null,
    centerName: c?.name ?? null,
    centerSlug: c ? slugify(c.name) : null,
    patientId: p?.id ?? null,
    patientLabel: p?.label ?? null,
    patientSlug: p ? slugify(p.label) : null,
    transcriptPreview: transcriptText,
    scores: scoresRaw
      .filter((row) => isStepScorable(kind, row.stepNumber))
      .map((s) => ({
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
  };
}

function formatTs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type ExistingPage = {
  path: string;
  contentMd: string;
};

async function loadRelevantPages(ctx: SessionContext): Promise<ExistingPage[]> {
  const paths: string[] = [];
  if (ctx.practitionerSlug) paths.push(`practitioners/${ctx.practitionerSlug}.md`);
  if (ctx.centerSlug) paths.push(`centers/${ctx.centerSlug}.md`);
  if (ctx.patientSlug) paths.push(`patients/${ctx.patientSlug}.md`);

  const directRows = paths.length
    ? await db.select().from(vaultPages).where(inArray(vaultPages.path, paths))
    : [];

  // Patterns candidats : on charge les fiches kind='pattern' liées à l'un des
  // types/related_step évoqués dans les insights, soit via texte du title.
  const patternRows = await db
    .select()
    .from(vaultPages)
    .where(eq(vaultPages.kind, "pattern"))
    .limit(20);

  const all: ExistingPage[] = [];
  for (const r of directRows) all.push({ path: r.path, contentMd: r.contentMd });
  for (const r of patternRows) all.push({ path: r.path, contentMd: r.contentMd });
  return all;
}

async function callClaudeForPatches(
  ctx: SessionContext,
  existingPages: ExistingPage[]
): Promise<Patch[]> {
  const anthropic = getAnthropic();

  const system = `${getLocaleInstruction(ctx.locale)}

Tu es le maintenance agent du LLM Wiki de Clinic OS (pattern Karpathy). Après chaque session analysée, tu mets à jour le vault markdown qui contient la mémoire organisationnelle du réseau.

PRINCIPES NON NÉGOCIABLES :
- Tu ENRICHIS les fiches existantes, tu ne les RÉÉCRIS pas. Conserve toujours le contenu existant. Toute modification est additive ou un raffinement narratif ciblé d'une section.
- Le frontmatter YAML reste minimaliste et déterministe (champs scalaires : type, entity_id, sessions_analyzed, avg_score, trend, updated_at). Tu ne mets PAS d'arrays narratifs en frontmatter (forces, weaknesses, etc.) — ces listes vivent en markdown.
- Tu utilises [[wikilinks]] pour relier fiches (ex: [[lyon-3]], [[session-abc123]], [[objection-prix-non-traitee]]).
- Tu écris du français professionnel factuel, sans jugement.
- Tu ne supprimes jamais de contenu. Tu marques au pire "à revoir" ou similaire.

OPÉRATIONS :
- create : nouvelle fiche (frontmatter complet + contenu markdown structuré)
- replace : remplace l'intégralité de la fiche (utiliser quand le frontmatter bouge ou la synthèse est réécrite)
- append_section : ajoute du contenu sous une section existante (préciser section_heading)

PATCHES OBLIGATOIRES À PRODUIRE :
1. **Fiche session** (path: sessions/<sessionShort>.md, kind='session', operation='create') — toujours.
2. **Fiche audioprothésiste** : si l'audioprothésiste est renseigné, tu DOIS produire un patch sur sa fiche. Si elle existe (operation='replace' ou 'append_section'), met à jour le frontmatter (sessions_analyzed +1, avg_score recalculé, updated_at), ajoute la session dans "## Sessions récentes", ajuste "## Forces récurrentes" et "## Points d'amélioration". Si elle n'existe pas (operation='create'), crée-la avec frontmatter (type='practitioner', sessions_analyzed=1, avg_score=score global, trend='stable', updated_at) et un squelette markdown (synthèse courte, sections "## Forces récurrentes", "## Points d'amélioration", "## Sessions récentes" avec un lien [[session-<sessionShort>]]).
3. **Fiche patient** : si la session a un patient lié, tu DOIS produire un patch sur sa fiche. Si elle existe (operation='replace' ou 'append_section' sur "## Timeline"), enrichis-la avec cette session. **Si elle n'existe pas, crée-la (operation='create') avec frontmatter (type='patient', entity_id, updated_at) et un squelette markdown : titre du patient, courte synthèse contextuelle, "## Timeline" listant la session courante (date, kind, score, insight clé, lien [[session-<sessionShort>]]), "## Profil & contexte" si des éléments ressortent du transcript ou des insights.** Ne jamais sauter ce patch quand un patient est lié.
4. **Si tu détectes un pattern récurrent** ou **si une fiche pattern existante est concernée par les insights** : crée la fiche pattern (kind='pattern') ou ajoute à la section "## Sessions où ce pattern a été détecté".

Au TOTAL : minimum 2 patches, idéalement 3-5.`;

  const existingPagesBlock =
    existingPages.length === 0
      ? "Aucune fiche existante pour cette session — toutes les fiches concernées doivent être créées (operation='create')."
      : existingPages
          .map(
            (p) =>
              `=== ${p.path} ===\n${p.contentMd.slice(0, 2500)}${p.contentMd.length > 2500 ? "\n…(tronqué)" : ""}`
          )
          .join("\n\n");

  const user = `CONTEXTE SESSION :
- session_id court : ${ctx.sessionShort}
- kind : ${ctx.kind}
- date : ${ctx.startedAt ? ctx.startedAt.toISOString().slice(0, 10) : "non renseignée"}
- durée : ${ctx.durationSeconds ?? "?"} s
- score global : ${ctx.globalScore ?? "?"}/100
- summary analyste : ${ctx.summary ?? "—"}

ENTITÉS LIÉES :
- audioprothésiste : ${ctx.practitionerName ?? "non renseigné"}${ctx.practitionerSlug ? ` (slug : ${ctx.practitionerSlug})` : ""}
- centre : ${ctx.centerName ?? "non renseigné"}${ctx.centerSlug ? ` (slug : ${ctx.centerSlug})` : ""}
- patient : ${ctx.patientLabel ?? "non renseigné"}${ctx.patientSlug ? ` (slug : ${ctx.patientSlug})` : ""}

SCORES PAR ÉTAPE :
${ctx.scores
  .map(
    (s) =>
      `${s.stepNumber}. ${s.stepName} — ${s.score === null ? "non évalué" : `${s.score}/100`}${s.rationale ? ` — ${s.rationale}` : ""}`
  )
  .join("\n")}

INSIGHTS DE COACHING :
${ctx.insights
  .map(
    (i) =>
      `- [${i.severity ?? "info"}] ${i.type} — ${i.title} : ${i.description}${i.estimatedImpactEur ? ` (impact ${i.estimatedImpactEur} €)` : ""}`
  )
  .join("\n")}

EXTRAIT TRANSCRIPT (60 premières lignes) :
${ctx.transcriptPreview}

FICHES VAULT EXISTANTES À ENRICHIR (peuvent être vides si rien n'existe encore) :

${existingPagesBlock}

Mets à jour le vault en appelant l'outil emit_vault_updates. Au minimum produit la fiche session (path: sessions/${ctx.sessionShort}.md)${ctx.patientSlug ? ` ET la fiche patient (path: patients/${ctx.patientSlug}.md — créer si absente, enrichir si existante)` : ""}${ctx.practitionerSlug ? `. Crée ou mets à jour la fiche audioprothésiste (path: practitioners/${ctx.practitionerSlug}.md)` : ""}. Si pertinent, propose une fiche pattern.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODELS.sonnet,
    max_tokens: 5000,
    system,
    tools: [
      {
        name: "emit_vault_updates",
        description: "Soumet un ensemble de patches à appliquer au vault.",
        input_schema: {
          type: "object",
          properties: {
            patches: {
              type: "array",
              minItems: 2,
              maxItems: 6,
              items: {
                type: "object",
                properties: {
                  path: {
                    type: "string",
                    description:
                      "Chemin relatif du fichier dans le vault, ex 'practitioners/goldminc-jonathan.md'.",
                  },
                  operation: {
                    type: "string",
                    enum: ["create", "replace", "append_section"],
                  },
                  section_heading: {
                    type: ["string", "null"],
                    description:
                      "Requis si operation='append_section'. Heading exact (ex '## Sessions récentes') de la section sous laquelle ajouter le contenu.",
                  },
                  content_md: {
                    type: "string",
                    description:
                      "Markdown complet pour create/replace, ou contenu à ajouter pour append_section.",
                  },
                  metadata_diff: {
                    type: ["object", "null"],
                    description:
                      "Patch partiel sur le frontmatter scalaire (sessions_analyzed, avg_score, trend, updated_at).",
                    properties: {
                      sessions_analyzed: { type: "integer" },
                      avg_score: { type: "integer" },
                      trend: {
                        type: "string",
                        enum: ["improving", "stable", "declining"],
                      },
                      updated_at: { type: "string" },
                    },
                  },
                },
                required: ["path", "operation", "content_md"],
              },
            },
          },
          required: ["patches"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_vault_updates" },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas invoqué emit_vault_updates");
  }
  const input = toolUse.input as RawPatchResponse;
  return Array.isArray(input.patches) ? input.patches.slice(0, 6) : [];
}

async function applyPatch(patch: Patch, ctx: SessionContext): Promise<void> {
  const path = patch.path.replace(/^\//, "");
  const kind = inferKind(path);

  let finalContent: string;
  let finalMeta: VaultMetadata;

  const existingMd = await readVaultFile(path);
  const now = new Date().toISOString();

  if (patch.operation === "create" || (patch.operation === "replace" && existingMd === null)) {
    const parsed = parseFrontmatter(patch.content_md);
    finalMeta = mergeMetadata(parsed.metadata, {
      type: kind,
      ...(patch.metadata_diff ?? {}),
      updated_at: patch.metadata_diff?.updated_at ?? now,
    });
    enrichEntityId(finalMeta, kind, ctx);
    finalContent = serializeFrontmatter(finalMeta, parsed.content);
  } else if (patch.operation === "replace") {
    const parsed = parseFrontmatter(patch.content_md);
    const current = parseFrontmatter(existingMd ?? "");
    finalMeta = mergeMetadata(current.metadata, {
      ...parsed.metadata,
      ...(patch.metadata_diff ?? {}),
      updated_at: patch.metadata_diff?.updated_at ?? now,
    });
    enrichEntityId(finalMeta, kind, ctx);
    finalContent = serializeFrontmatter(finalMeta, parsed.content);
  } else if (patch.operation === "append_section") {
    const parsed = parseFrontmatter(existingMd ?? `---\ntype: ${kind}\n---\n# ${pathToTitle(path)}\n`);
    finalMeta = mergeMetadata(parsed.metadata, {
      type: parsed.metadata.type ?? kind,
      ...(patch.metadata_diff ?? {}),
      updated_at: patch.metadata_diff?.updated_at ?? now,
    });
    enrichEntityId(finalMeta, kind, ctx);
    const heading = patch.section_heading?.trim() ?? "";
    const newBody = appendUnderHeading(parsed.content, heading, patch.content_md);
    finalContent = serializeFrontmatter(finalMeta, newBody);
  } else {
    return;
  }

  await writeVaultFile(path, finalContent);

  const backlinks = extractWikilinks(finalContent);
  const title = extractTitle(finalContent) ?? pathToTitle(path);
  const entityId = pickEntityId(kind, finalMeta, ctx);

  await db
    .insert(vaultPages)
    .values({
      path,
      kind,
      entityId,
      title,
      contentMd: finalContent,
      metadata: finalMeta,
      backlinks,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: vaultPages.path,
      set: {
        kind,
        entityId,
        title,
        contentMd: finalContent,
        metadata: finalMeta,
        backlinks,
        updatedAt: new Date(),
      },
    });
}

function inferKind(path: string): string {
  if (path.startsWith("practitioners/")) return "practitioner";
  if (path.startsWith("assistants/")) return "assistant";
  if (path.startsWith("centers/")) return "center";
  if (path.startsWith("patients/")) return "patient";
  if (path.startsWith("patterns/")) return "pattern";
  if (path.startsWith("sessions/")) return "session";
  if (path === "index.md") return "index";
  return "pattern";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickEntityId(kind: string, meta: VaultMetadata, ctx: SessionContext): string | null {
  if (typeof meta.entity_id === "string" && UUID_RE.test(meta.entity_id)) {
    return meta.entity_id;
  }
  if (kind === "practitioner") return ctx.practitionerId;
  if (kind === "center") return ctx.centerId;
  if (kind === "patient") return ctx.patientId;
  if (kind === "session") return ctx.sessionId;
  return null;
}

function enrichEntityId(meta: VaultMetadata, kind: string, ctx: SessionContext): void {
  const existing =
    typeof meta.entity_id === "string" && UUID_RE.test(meta.entity_id)
      ? meta.entity_id
      : null;
  if (existing) return;
  const id = pickEntityId(kind, meta, ctx);
  if (id) meta.entity_id = id;
  else if (meta.entity_id) delete meta.entity_id;
}

function appendUnderHeading(content: string, heading: string, addition: string): string {
  if (!heading) {
    return `${content.trimEnd()}\n\n${addition}\n`;
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.trim() === heading.trim());
  if (idx === -1) {
    return `${content.trimEnd()}\n\n${heading}\n\n${addition}\n`;
  }
  let insertAt = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      insertAt = i;
      break;
    }
  }
  const before = lines.slice(0, insertAt).join("\n").trimEnd();
  const after = lines.slice(insertAt).join("\n");
  return `${before}\n${addition.trim()}\n${after ? `\n${after}` : ""}`.trim() + "\n";
}

function extractTitle(content: string): string | null {
  const parsed = parseFrontmatter(content);
  const m = parsed.content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function pathToTitle(path: string): string {
  const base = path.replace(/^.*\//, "").replace(/\.md$/, "");
  return base
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function buildSessionFallback(path: string, ctx: SessionContext): Patch {
  const dateStr = ctx.startedAt ? ctx.startedAt.toISOString().slice(0, 10) : "non renseignée";
  const lines = [
    `# Session ${ctx.sessionShort}`,
    "",
    `**Date** : ${dateStr}`,
    `**Type** : ${ctx.kind === "consultation" ? "Consultation" : "Appel entrant"}`,
    ctx.practitionerName ? `**Audioprothésiste** : [[${ctx.practitionerSlug}]]` : null,
    ctx.centerName ? `**Centre** : [[${ctx.centerSlug}]]` : null,
    ctx.patientLabel ? `**Patient** : [[${ctx.patientSlug}]]` : null,
    `**Score global** : ${ctx.globalScore ?? "—"}/100`,
    "",
    "## Synthèse",
    "",
    ctx.summary ?? "Synthèse non disponible.",
    "",
    "## Insights principaux",
    "",
    ctx.insights
      .slice(0, 5)
      .map((i) => `- **${i.title}** — ${i.description}`)
      .join("\n") || "_Aucun insight enregistré._",
  ]
    .filter(Boolean)
    .join("\n");

  const meta: VaultMetadata = {
    type: "session",
    entity_id: ctx.sessionId,
    session_id: ctx.sessionId,
    global_score: ctx.globalScore ?? undefined,
    date: ctx.startedAt ? ctx.startedAt.toISOString().slice(0, 10) : undefined,
    duration_seconds: ctx.durationSeconds ?? undefined,
  };

  return {
    path,
    operation: "create",
    content_md: serializeFrontmatter(meta, lines),
    metadata_diff: { updated_at: new Date().toISOString() },
  };
}

function log(
  sessionId: string,
  step: string,
  status: string,
  durationMs: number,
  extra: Record<string, unknown> = {}
) {
  console.log(
    JSON.stringify({ tag: "vault", sessionId, step, status, durationMs, ...extra })
  );
}

// Helpers utilisés ailleurs (admin/vault list, seed) :
export async function listVaultPagesByKind(): Promise<
  Map<string, { path: string; title: string; updatedAt: Date | null; entityId: string | null }[]>
> {
  const rows = await db
    .select({
      path: vaultPages.path,
      kind: vaultPages.kind,
      title: vaultPages.title,
      updatedAt: vaultPages.updatedAt,
      entityId: vaultPages.entityId,
    })
    .from(vaultPages)
    .orderBy(asc(vaultPages.path));
  const map = new Map<
    string,
    { path: string; title: string; updatedAt: Date | null; entityId: string | null }[]
  >();
  for (const r of rows) {
    const arr = map.get(r.kind) ?? [];
    arr.push({
      path: r.path,
      title: r.title,
      updatedAt: r.updatedAt ?? null,
      entityId: r.entityId,
    });
    map.set(r.kind, arr);
  }
  return map;
}

export async function getVaultPageByPath(path: string): Promise<{
  path: string;
  kind: string;
  title: string;
  contentMd: string;
  metadata: VaultMetadata | null;
  backlinks: string[];
  updatedAt: Date | null;
} | null> {
  const rows = await db
    .select()
    .from(vaultPages)
    .where(eq(vaultPages.path, path))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    path: r.path,
    kind: r.kind,
    title: r.title,
    contentMd: r.contentMd,
    metadata: (r.metadata as VaultMetadata | null) ?? null,
    backlinks: Array.isArray(r.backlinks) ? (r.backlinks as string[]) : [],
    updatedAt: r.updatedAt ?? null,
  };
}

export async function getInboundBacklinks(targetPath: string): Promise<
  { path: string; title: string }[]
> {
  // On scanne les backlinks jsonb pour trouver les fiches qui pointent vers
  // le slug correspondant à targetPath.
  const targetSlug = targetPath.replace(/^.*\//, "").replace(/\.md$/, "");
  const rows = await db
    .select({ path: vaultPages.path, title: vaultPages.title, backlinks: vaultPages.backlinks })
    .from(vaultPages)
    .where(sql`${vaultPages.backlinks} ?| array[${targetSlug}]`);
  return rows
    .filter((r) => r.path !== targetPath)
    .map((r) => ({ path: r.path, title: r.title }));
}

// Re-export utilisé par les helpers de seed :
export { writeVaultFile, ensureVaultBucket } from "@/lib/vault/storage";

// Garde-fou pour éviter une dépendance circulaire si ce module est importé
// avant Drizzle :
void and;
