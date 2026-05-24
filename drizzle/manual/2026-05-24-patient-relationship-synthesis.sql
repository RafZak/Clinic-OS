-- Additif uniquement : crée la table patient_relationship_synthesis.
-- Ne modifie/supprime AUCUNE table existante. Sûr à appliquer avant la démo.
-- À exécuter dans l'éditeur SQL Supabase (ou via psql) sur la base de prod.

CREATE TABLE IF NOT EXISTS "patient_relationship_synthesis" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "patient_id" uuid NOT NULL,
    "abstract_md" text NOT NULL,
    "communication_style" jsonb NOT NULL,
    "setbacks" jsonb NOT NULL,
    "priorities" jsonb NOT NULL,
    "sessions_count" smallint DEFAULT 0 NOT NULL,
    "model" text NOT NULL,
    "prompt_version" text NOT NULL,
    "raw_output" jsonb NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "patient_relationship_synthesis_patient_unique" UNIQUE("patient_id"),
    CONSTRAINT "patient_relationship_synthesis_patient_id_patients_id_fk"
        FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id")
        ON DELETE cascade ON UPDATE no action
);
