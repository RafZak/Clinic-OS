-- Clinic OS — Schéma de base de données complet
-- Référence : CLAUDE.md section 8
-- À convertir en migrations Drizzle ORM lors du J1

-- ============================================================
-- 1. Centres (déclaré en premier pour FK)
-- ============================================================
create table centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,                   -- "Lyon 3", "Paris Bastille"
  city text,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. Users fictifs (audioprothésistes ET assistants)
-- ============================================================
create table practitioners (
  id uuid primary key default gen_random_uuid(),
  role text not null,                   -- "audioprothesiste" | "assistant"
  full_name text not null,
  center_id uuid references centers(id),
  avatar_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. Programmes de formation (10 cartes dont 4 actives)
-- ============================================================
create table programs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  category text not null,               -- "acquisition" | "points-de-contact" | "appareillage" | "fidelisation"
  icon text,
  is_available boolean default false,
  order_idx int not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 4. Modules
-- ============================================================
create table modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references programs(id) on delete cascade,
  number int not null,
  title text not null,
  description text,
  video_url text,
  duration_seconds int,
  order_idx int not null,
  created_at timestamptz default now(),
  unique (program_id, number)
);

-- ============================================================
-- 5. Livrets PDF
-- ============================================================
create table livrets (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade,
  number int not null,
  title text not null,
  pdf_url text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 6. Patients fictifs (pour la démo parcours patient)
-- ============================================================
create table patients (
  id uuid primary key default gen_random_uuid(),
  label text not null,                  -- "Mme Durand"
  age int,
  created_at timestamptz default now()
);

-- ============================================================
-- 7. Sessions (consultations ET appels — unifié)
-- ============================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                   -- "consultation" | "phone_call"
  practitioner_id uuid references practitioners(id),
  patient_id uuid references patients(id),
  source text not null,                 -- "live" | "replay" | "seed"
  audio_url text,
  duration_seconds int,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'in_progress',
  global_score int,
  summary text,
  created_at timestamptz default now()
);

-- ============================================================
-- 8. Lignes de transcription
-- ============================================================
create table transcript_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  speaker text not null,                -- "practitioner" | "patient"
  start_ms int not null,
  end_ms int not null,
  text text not null,
  confidence numeric(4,3),
  created_at timestamptz default now()
);

-- ============================================================
-- 9. Scores par étape du framework
-- ============================================================
create table session_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  step_number int not null,
  step_name text not null,
  score int,
  rationale text,
  examples jsonb,
  created_at timestamptz default now(),
  unique (session_id, step_number)
);

-- ============================================================
-- 10. Insights de coaching
-- ============================================================
create table coaching_insights (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  type text not null,                   -- "missed_objection" | "upsell_missed" | "good_practice" | "improvement"
  severity text,                        -- "info" | "warning" | "critical"
  title text not null,
  description text not null,
  timestamp_ms int,
  related_step int,
  estimated_impact_eur int,
  citation_chunks jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 11. Artefacts post-consultation
-- ============================================================
create table session_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  type text not null,                   -- "clinical_notes" | "patient_email" | "patient_sms" | "orl_letter"
  content text not null,
  metadata jsonb,
  created_at timestamptz default now(),
  unique (session_id, type)
);

-- ============================================================
-- 12. Événements du parcours patient (timeline)
-- ============================================================
create table patient_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  kind text not null,                   -- "phone_call" | "appointment_scheduled" | "consultation" | "trial_start" | "delivery" | "follow_up"
  session_id uuid references sessions(id), -- lien vers la session analysée si applicable
  occurred_at timestamptz not null,
  summary text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 13. Layer A — Knowledge chunks formation (RAG vectoriel)
-- ============================================================
create extension if not exists vector;

create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_type text not null,            -- "pdf" | "video_transcript" | "docx"
  program_slug text,
  module_number int,
  chunk_index int not null,
  content text not null,
  metadata jsonb,
  embedding vector(1024),               -- voyage-3-lite output
  drive_file_id text,
  drive_modified_at timestamptz,
  created_at timestamptz default now()
);

create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on knowledge_chunks (program_slug);
create index on knowledge_chunks (drive_file_id);

-- ============================================================
-- 14. Layer B — Vault pages (pattern Karpathy)
-- ============================================================
create table vault_pages (
  id uuid primary key default gen_random_uuid(),
  path text unique not null,            -- "practitioners/jonathan-goldminc.md"
  kind text not null,                   -- "practitioner" | "assistant" | "center" | "patient" | "pattern" | "session" | "index"
  entity_id uuid,                       -- FK vers practitioners, centers, patients, sessions selon kind
  title text not null,
  content_md text not null,             -- contenu markdown complet
  metadata jsonb,                       -- front matter parsé
  backlinks jsonb,                      -- pages qui référencent celle-ci
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create index on vault_pages (kind);
create index on vault_pages (entity_id);

-- ============================================================
-- 15. Logs ingestion
-- ============================================================
create table ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'running',
  files_processed int default 0,
  chunks_created int default 0,
  errors jsonb,
  triggered_by text                     -- "manual" | "cron"
);
