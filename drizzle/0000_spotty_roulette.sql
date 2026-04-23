CREATE TABLE "centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coaching_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"timestamp_ms" integer,
	"related_step" integer,
	"estimated_impact_eur" integer,
	"citation_chunks" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "coaching_insights_type_check" CHECK ("coaching_insights"."type" in ('missed_objection', 'upsell_missed', 'good_practice', 'improvement')),
	CONSTRAINT "coaching_insights_severity_check" CHECK ("coaching_insights"."severity" is null or "coaching_insights"."severity" in ('info', 'warning', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone,
	"status" text DEFAULT 'running',
	"files_processed" integer DEFAULT 0,
	"chunks_created" integer DEFAULT 0,
	"errors" jsonb,
	"triggered_by" text,
	CONSTRAINT "ingestion_runs_status_check" CHECK ("ingestion_runs"."status" in ('running', 'success', 'partial', 'failed')),
	CONSTRAINT "ingestion_runs_triggered_by_check" CHECK ("ingestion_runs"."triggered_by" is null or "ingestion_runs"."triggered_by" in ('manual', 'cron'))
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file" text NOT NULL,
	"source_type" text NOT NULL,
	"program_slug" text,
	"module_number" integer,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"embedding" vector(1024),
	"drive_file_id" text,
	"drive_modified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "knowledge_chunks_source_type_check" CHECK ("knowledge_chunks"."source_type" in ('pdf', 'video_transcript', 'docx'))
);
--> statement-breakpoint
CREATE TABLE "livrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"pdf_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"video_url" text,
	"duration_seconds" integer,
	"order_idx" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "modules_program_number_unique" UNIQUE("program_id","number")
);
--> statement-breakpoint
CREATE TABLE "patient_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"session_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"summary" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "patient_events_kind_check" CHECK ("patient_events"."kind" in ('phone_call', 'appointment_scheduled', 'consultation', 'trial_start', 'delivery', 'follow_up')),
	CONSTRAINT "patient_events_session_required" CHECK ("patient_events"."kind" not in ('phone_call', 'consultation') or "patient_events"."session_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"age" integer,
	"status" text DEFAULT 'prospect' NOT NULL,
	"first_contact_at" timestamp with time zone,
	"center_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "patients_status_check" CHECK ("patients"."status" in ('prospect', 'patient', 'lost'))
);
--> statement-breakpoint
CREATE TABLE "practitioners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"full_name" text NOT NULL,
	"center_id" uuid,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "practitioners_role_check" CHECK ("practitioners"."role" in ('audioprothesiste', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"icon" text,
	"is_available" boolean DEFAULT false,
	"order_idx" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "programs_slug_unique" UNIQUE("slug"),
	CONSTRAINT "programs_category_check" CHECK ("programs"."category" in ('acquisition', 'points-de-contact', 'appareillage', 'fidelisation'))
);
--> statement-breakpoint
CREATE TABLE "session_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "session_artifacts_session_type_unique" UNIQUE("session_id","type"),
	CONSTRAINT "session_artifacts_type_check" CHECK ("session_artifacts"."type" in ('clinical_notes', 'patient_email', 'patient_sms', 'orl_letter'))
);
--> statement-breakpoint
CREATE TABLE "session_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"step_name" text NOT NULL,
	"score" integer,
	"rationale" text,
	"examples" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "session_scores_session_step_unique" UNIQUE("session_id","step_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"practitioner_id" uuid,
	"patient_id" uuid,
	"source" text NOT NULL,
	"audio_url" text,
	"duration_seconds" integer,
	"started_at" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone,
	"status" text DEFAULT 'in_progress',
	"global_score" integer,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sessions_kind_check" CHECK ("sessions"."kind" in ('consultation', 'phone_call')),
	CONSTRAINT "sessions_source_check" CHECK ("sessions"."source" in ('live', 'replay', 'seed')),
	CONSTRAINT "sessions_status_check" CHECK ("sessions"."status" in ('in_progress', 'completed', 'aborted'))
);
--> statement-breakpoint
CREATE TABLE "transcript_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"speaker" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	"confidence" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transcript_lines_speaker_check" CHECK ("transcript_lines"."speaker" in ('practitioner', 'patient'))
);
--> statement-breakpoint
CREATE TABLE "vault_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"kind" text NOT NULL,
	"entity_id" uuid,
	"title" text NOT NULL,
	"content_md" text NOT NULL,
	"metadata" jsonb,
	"backlinks" jsonb,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vault_pages_path_unique" UNIQUE("path"),
	CONSTRAINT "vault_pages_kind_check" CHECK ("vault_pages"."kind" in ('practitioner', 'assistant', 'center', 'patient', 'pattern', 'session', 'index'))
);
--> statement-breakpoint
ALTER TABLE "coaching_insights" ADD CONSTRAINT "coaching_insights_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livrets" ADD CONSTRAINT "livrets_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_events" ADD CONSTRAINT "patient_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_events" ADD CONSTRAINT "patient_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_center_id_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_center_id_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_artifacts" ADD CONSTRAINT "session_artifacts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_scores" ADD CONSTRAINT "session_scores_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_lines" ADD CONSTRAINT "transcript_lines_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coaching_insights_session_idx" ON "coaching_insights" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100);--> statement-breakpoint
CREATE INDEX "knowledge_chunks_program_idx" ON "knowledge_chunks" USING btree ("program_slug");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_drive_idx" ON "knowledge_chunks" USING btree ("drive_file_id");--> statement-breakpoint
CREATE INDEX "patient_events_patient_idx" ON "patient_events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "transcript_lines_session_idx" ON "transcript_lines" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "vault_pages_kind_idx" ON "vault_pages" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "vault_pages_entity_idx" ON "vault_pages" USING btree ("entity_id");