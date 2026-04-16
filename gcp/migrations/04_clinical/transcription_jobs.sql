-- Table: transcription_jobs
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.transcription_jobs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'processing',
  audio_url TEXT,
  result_text TEXT,
  duration_ms INTEGER,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT,
  job_name TEXT NOT NULL,
  s3_uri TEXT NOT NULL,
  transcript TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.transcription_jobs ADD CONSTRAINT transcription_jobs_job_name_key UNIQUE (job_name);

ALTER TABLE public.transcription_jobs ADD CONSTRAINT transcription_jobs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
