-- Additif uniquement : crée la table practitioner_care_snapshots.
-- Ne modifie/supprime AUCUNE table existante. Sûr à appliquer avant la démo.
-- À exécuter dans l'éditeur SQL Supabase (ou via psql) sur la base de prod.

CREATE TABLE IF NOT EXISTS "practitioner_care_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "practitioner_id" uuid NOT NULL,
  "rapport_score" smallint,
  "pedagogy_score" smallint,
  "structure_score" smallint,
  "guidance_score" smallint,
  "follow_through_score" smallint,
  "adaptability_score" smallint,
  "rationale" jsonb,
  "source" text NOT NULL,
  "sessions_count" smallint DEFAULT 0 NOT NULL,
  "model" text,
  "prompt_version" text,
  "raw_output" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "practitioner_care_snapshots_practitioner_unique" UNIQUE("practitioner_id"),
  CONSTRAINT "practitioner_care_snapshots_practitioner_id_fk"
    FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE cascade
);
