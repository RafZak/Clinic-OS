import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ==================================================================
// 1. Centres
// ==================================================================
export const centers = pgTable("centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ==================================================================
// 2. Practitioners (audioprothésistes + assistants)
// ==================================================================
export const practitioners = pgTable(
  "practitioners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role").notNull(),
    fullName: text("full_name").notNull(),
    centerId: uuid("center_id").references(() => centers.id),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "practitioners_role_check",
      sql`${t.role} in ('audioprothesiste', 'assistant')`
    ),
  ]
);

// ==================================================================
// 3. Programs (10 catalog cards, 4 active)
// ==================================================================
export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    icon: text("icon"),
    isAvailable: boolean("is_available").default(false),
    orderIdx: integer("order_idx").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "programs_category_check",
      sql`${t.category} in ('acquisition', 'points-de-contact', 'appareillage', 'fidelisation')`
    ),
  ]
);

// ==================================================================
// 4. Modules
// ==================================================================
export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id").references(() => programs.id, {
      onDelete: "cascade",
    }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    videoUrl: text("video_url"),
    durationSeconds: integer("duration_seconds"),
    orderIdx: integer("order_idx").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("modules_program_number_unique").on(t.programId, t.number)]
);

// ==================================================================
// 5. Livrets PDF
// ==================================================================
export const livrets = pgTable("livrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id").references(() => modules.id, {
    onDelete: "cascade",
  }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  pdfUrl: text("pdf_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ==================================================================
// 6. Patients (enriched with status + first_contact_at + center_id)
// ==================================================================
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    age: integer("age"),
    status: text("status").notNull().default("prospect"),
    firstContactAt: timestamp("first_contact_at", { withTimezone: true }),
    centerId: uuid("center_id").references(() => centers.id),
    marketingPsyConsentAt: timestamp("marketing_psy_consent_at", {
      withTimezone: true,
    }),
    marketingPsyRevokedAt: timestamp("marketing_psy_revoked_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "patients_status_check",
      sql`${t.status} in ('prospect', 'patient', 'lost')`
    ),
  ]
);

// ==================================================================
// 7. Sessions (consultations + phone_calls)
// ==================================================================
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id),
    patientId: uuid("patient_id").references(() => patients.id),
    source: text("source").notNull(),
    audioUrl: text("audio_url"),
    durationSeconds: integer("duration_seconds"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: text("status").default("in_progress"),
    globalScore: integer("global_score"),
    summary: text("summary"),
    analysisStatus: text("analysis_status").default("pending"),
    analysisError: text("analysis_error"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "sessions_kind_check",
      sql`${t.kind} in ('consultation', 'phone_call')`
    ),
    check(
      "sessions_source_check",
      sql`${t.source} in ('live', 'replay', 'seed')`
    ),
    check(
      "sessions_status_check",
      sql`${t.status} in ('in_progress', 'completed', 'aborted')`
    ),
    check(
      "sessions_analysis_status_check",
      sql`${t.analysisStatus} in ('pending', 'transcribing', 'transcribed', 'analyzing', 'done', 'failed')`
    ),
  ]
);

// ==================================================================
// 8. Transcript lines (Deepgram output)
// ==================================================================
export const transcriptLines = pgTable(
  "transcript_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    speaker: text("speaker").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    text: text("text").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "transcript_lines_speaker_check",
      sql`${t.speaker} in ('practitioner', 'patient')`
    ),
    index("transcript_lines_session_idx").on(t.sessionId),
  ]
);

// ==================================================================
// 9. Session scores (per framework step)
// ==================================================================
export const sessionScores = pgTable(
  "session_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    stepName: text("step_name").notNull(),
    score: integer("score"),
    rationale: text("rationale"),
    examples: jsonb("examples"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("session_scores_session_step_unique").on(t.sessionId, t.stepNumber),
  ]
);

// ==================================================================
// 10. Coaching insights
// ==================================================================
export const coachingInsights = pgTable(
  "coaching_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    severity: text("severity"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    timestampMs: integer("timestamp_ms"),
    relatedStep: integer("related_step"),
    estimatedImpactEur: integer("estimated_impact_eur"),
    citationChunks: jsonb("citation_chunks"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "coaching_insights_type_check",
      sql`${t.type} in ('missed_objection', 'upsell_missed', 'good_practice', 'improvement')`
    ),
    check(
      "coaching_insights_severity_check",
      sql`${t.severity} is null or ${t.severity} in ('info', 'warning', 'critical')`
    ),
    index("coaching_insights_session_idx").on(t.sessionId),
  ]
);

// ==================================================================
// 11. Session artefacts (4 per session)
// ==================================================================
export const sessionArtifacts = pgTable(
  "session_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "session_artifacts_type_check",
      sql`${t.type} in ('clinical_notes', 'patient_email', 'patient_sms', 'orl_letter')`
    ),
    unique("session_artifacts_session_type_unique").on(t.sessionId, t.type),
  ]
);

// ==================================================================
// 12. Patient timeline events
// ==================================================================
export const patientEvents = pgTable(
  "patient_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sessionId: uuid("session_id").references(() => sessions.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    summary: text("summary"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "patient_events_kind_check",
      sql`${t.kind} in ('phone_call', 'appointment_scheduled', 'consultation', 'trial_start', 'delivery', 'follow_up')`
    ),
    check(
      "patient_events_session_required",
      sql`${t.kind} not in ('phone_call', 'consultation') or ${t.sessionId} is not null`
    ),
    index("patient_events_patient_idx").on(t.patientId),
  ]
);

// ==================================================================
// 13. Knowledge chunks (Layer A — RAG)
// ==================================================================
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceFile: text("source_file").notNull(),
    sourceType: text("source_type").notNull(),
    programSlug: text("program_slug"),
    moduleNumber: integer("module_number"),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    embedding: vector("embedding", { dimensions: 512 }),
    driveFileId: text("drive_file_id"),
    driveModifiedAt: timestamp("drive_modified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "knowledge_chunks_source_type_check",
      sql`${t.sourceType} in ('pdf', 'video_transcript', 'docx')`
    ),
    index("knowledge_chunks_embedding_idx")
      .using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("knowledge_chunks_program_idx").on(t.programSlug),
    index("knowledge_chunks_drive_idx").on(t.driveFileId),
  ]
);

// ==================================================================
// 14. Vault pages (Layer B — organizational memory)
// ==================================================================
export const vaultPages = pgTable(
  "vault_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: text("path").notNull().unique(),
    kind: text("kind").notNull(),
    entityId: uuid("entity_id"),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull(),
    metadata: jsonb("metadata"),
    backlinks: jsonb("backlinks"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check(
      "vault_pages_kind_check",
      sql`${t.kind} in ('practitioner', 'assistant', 'center', 'patient', 'pattern', 'session', 'index')`
    ),
    index("vault_pages_kind_idx").on(t.kind),
    index("vault_pages_entity_idx").on(t.entityId),
  ]
);

// ==================================================================
// 15bis. Module progress (formation completion tracking)
// ==================================================================
export const moduleProgress = pgTable(
  "module_progress",
  {
    role: text("role").notNull(),
    driveFileId: text("drive_file_id").notNull(),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.role, t.driveFileId] }),
    check(
      "module_progress_role_check",
      sql`${t.role} in ('audioprothesiste', 'assistant')`
    ),
    index("module_progress_role_idx").on(t.role),
  ]
);

// ==================================================================
// 15ter. Quizzes (interactive quiz sets parsed from Drive)
// ==================================================================
export const quizSets = pgTable(
  "quiz_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programSlug: text("program_slug").notNull(),
    moduleNumber: integer("module_number"),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    passThreshold: integer("pass_threshold").notNull().default(80),
    sourceFile: text("source_file").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("quiz_sets_program_ordinal_uniq").on(t.programSlug, t.ordinal),
    index("quiz_sets_program_idx").on(t.programSlug, t.ordinal),
  ]
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizSetId: uuid("quiz_set_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    prompt: text("prompt").notNull(),
    kind: text("kind").notNull(),
    choices: jsonb("choices").notNull(),
    correctIds: text("correct_ids").array().notNull(),
    explanation: text("explanation").notNull(),
    relatedModule: integer("related_module"),
  },
  (t) => [
    unique("quiz_questions_set_position_uniq").on(t.quizSetId, t.position),
    check(
      "quiz_questions_kind_check",
      sql`${t.kind} in ('single', 'multi', 'boolean')`
    ),
  ]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizSetId: uuid("quiz_set_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "cascade" }),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    passed: boolean("passed").notNull(),
    answers: jsonb("answers").notNull(),
    durationMs: integer("duration_ms"),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("quiz_attempts_practitioner_idx").on(t.practitionerId),
    index("quiz_attempts_set_idx").on(t.quizSetId),
  ]
);

// ==================================================================
// 15quater. Session psychology snapshots (1 par session, IA auto post-analyse)
// ==================================================================
export const sessionPsychologySnapshots = pgTable(
  "session_psychology_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    acceptanceScore: smallint("acceptance_score"),
    motivationScore: smallint("motivation_score"),
    trustScore: smallint("trust_score"),
    priceSensitivityScore: smallint("price_sensitivity_score"),
    externalInfluenceScore: smallint("external_influence_score"),
    decisionStageScore: smallint("decision_stage_score"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rawOutput: jsonb("raw_output").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("session_psychology_session_unique").on(t.sessionId),
    index("session_psychology_patient_idx").on(t.patientId, t.createdAt),
    // GIN index sur tags ajouté manuellement dans la migration SQL (Drizzle ne génère pas GIN)
  ]
);

// ==================================================================
// 17. Consent audit log (RGPD)
// ==================================================================
export const consentAuditLog = pgTable(
  "consent_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    scope: text("scope").notNull(),
    actorId: uuid("actor_id").references(() => practitioners.id),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "consent_audit_action_check",
      sql`${t.action} in ('granted', 'revoked')`
    ),
    check("consent_audit_scope_check", sql`${t.scope} in ('marketing_psy')`),
    check(
      "consent_audit_source_check",
      sql`${t.source} in ('patient_page', 'admin', 'api')`
    ),
    index("consent_audit_patient_idx").on(t.patientId, t.createdAt),
  ]
);

// ==================================================================
// 18. Psychology export log (RGPD)
// ==================================================================
export const psychologyExportLog = pgTable(
  "psychology_export_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => practitioners.id),
    patientCount: integer("patient_count").notNull(),
    filters: jsonb("filters").notNull(),
    overrideNonConsenting: boolean("override_non_consenting")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("psy_export_actor_idx").on(t.actorId, t.createdAt)]
);

// ==================================================================
// 16. Ingestion runs (Drive sync logs)
// ==================================================================
export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: text("status").default("running"),
    filesProcessed: integer("files_processed").default(0),
    chunksCreated: integer("chunks_created").default(0),
    errors: jsonb("errors"),
    triggeredBy: text("triggered_by"),
  },
  (t) => [
    check(
      "ingestion_runs_status_check",
      sql`${t.status} in ('running', 'success', 'partial', 'failed')`
    ),
    check(
      "ingestion_runs_triggered_by_check",
      sql`${t.triggeredBy} is null or ${t.triggeredBy} in ('manual', 'cron')`
    ),
  ]
);
