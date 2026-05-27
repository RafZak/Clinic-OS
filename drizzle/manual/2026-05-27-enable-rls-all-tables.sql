-- Active Row Level Security sur toutes les tables du schéma public.
-- Idempotent : ENABLE RLS est sûr à ré-exécuter. Ne crée AUCUNE policy.
--
-- Pourquoi : Clinic OS n'a pas d'auth (toggle de rôle factice). Tous les accès
-- DB passent par la SERVICE_ROLE_KEY (côté serveur) ou par Drizzle en connexion
-- directe (DATABASE_URL) — les deux contournent RLS. L'anon key n'est jamais
-- utilisée pour requêter la DB. Activer RLS sans policy ferme donc l'API
-- publique PostgREST (anon) sans rien casser côté app.
--
-- Drizzle ne génère pas ces statements : à appliquer manuellement après tout
-- rebuild de la base from scratch. Cf. alerte sécurité Supabase du 2026-05-25.
-- À exécuter dans l'éditeur SQL Supabase (ou via psql) sur la base de prod.

ALTER TABLE "public"."centers"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."practitioners"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."programs"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."modules"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."livrets"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."patients"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sessions"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transcript_lines"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."session_scores"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."coaching_insights"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."session_artifacts"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."patient_events"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."knowledge_chunks"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vault_pages"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ingestion_runs"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."module_progress"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."quiz_sets"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."quiz_questions"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."quiz_attempts"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."consent_audit_log"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."psychology_export_log"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."session_psychology_snapshots"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."patient_relationship_synthesis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."practitioner_care_snapshots"    ENABLE ROW LEVEL SECURITY;
