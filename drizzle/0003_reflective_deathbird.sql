ALTER TABLE "sessions" ADD COLUMN "analysis_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "analysis_error" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "analyzed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_analysis_status_check" CHECK ("sessions"."analysis_status" in ('pending', 'transcribing', 'transcribed', 'analyzing', 'done', 'failed'));