CREATE TABLE IF NOT EXISTS "consent_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"action" text NOT NULL,
	"scope" text NOT NULL,
	"actor_id" uuid,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_audit_action_check" CHECK ("consent_audit_log"."action" in ('granted', 'revoked')),
	CONSTRAINT "consent_audit_scope_check" CHECK ("consent_audit_log"."scope" in ('marketing_psy')),
	CONSTRAINT "consent_audit_source_check" CHECK ("consent_audit_log"."source" in ('patient_page', 'admin', 'api'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "module_progress" (
	"role" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"watched_seconds" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_progress_role_drive_file_id_pk" PRIMARY KEY("role","drive_file_id"),
	CONSTRAINT "module_progress_role_check" CHECK ("module_progress"."role" in ('audioprothesiste', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "psychology_export_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"patient_count" integer NOT NULL,
	"filters" jsonb NOT NULL,
	"override_non_consenting" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_set_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"answers" jsonb NOT NULL,
	"duration_ms" integer,
	"completed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_set_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"prompt" text NOT NULL,
	"kind" text NOT NULL,
	"choices" jsonb NOT NULL,
	"correct_ids" text[] NOT NULL,
	"explanation" text NOT NULL,
	"related_module" integer,
	CONSTRAINT "quiz_questions_set_position_uniq" UNIQUE("quiz_set_id","position"),
	CONSTRAINT "quiz_questions_kind_check" CHECK ("quiz_questions"."kind" in ('single', 'multi', 'boolean'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_slug" text NOT NULL,
	"module_number" integer,
	"ordinal" integer NOT NULL,
	"title" text NOT NULL,
	"pass_threshold" integer DEFAULT 80 NOT NULL,
	"source_file" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "quiz_sets_program_ordinal_uniq" UNIQUE("program_slug","ordinal")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_psychology_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"acceptance_score" smallint,
	"motivation_score" smallint,
	"trust_score" smallint,
	"price_sensitivity_score" smallint,
	"external_influence_score" smallint,
	"decision_stage_score" smallint,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"raw_output" jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_psychology_session_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "marketing_psy_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "marketing_psy_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_audit_log" ADD CONSTRAINT "consent_audit_log_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_audit_log" ADD CONSTRAINT "consent_audit_log_actor_id_practitioners_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "psychology_export_log" ADD CONSTRAINT "psychology_export_log_actor_id_practitioners_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_set_id_quiz_sets_id_fk" FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_set_id_quiz_sets_id_fk" FOREIGN KEY ("quiz_set_id") REFERENCES "public"."quiz_sets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_psychology_snapshots" ADD CONSTRAINT "session_psychology_snapshots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_psychology_snapshots" ADD CONSTRAINT "session_psychology_snapshots_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_audit_patient_idx" ON "consent_audit_log" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_progress_role_idx" ON "module_progress" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "psy_export_actor_idx" ON "psychology_export_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_attempts_practitioner_idx" ON "quiz_attempts" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_attempts_set_idx" ON "quiz_attempts" USING btree ("quiz_set_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_sets_program_idx" ON "quiz_sets" USING btree ("program_slug","ordinal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_psychology_patient_idx" ON "session_psychology_snapshots" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_psychology_tags_gin_idx" ON "session_psychology_snapshots" USING GIN("tags");
