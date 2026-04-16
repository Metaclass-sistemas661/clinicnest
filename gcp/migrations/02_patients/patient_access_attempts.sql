-- Table: patient_access_attempts
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_access_attempts (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  identifier_hash TEXT NOT NULL,
  success BOOLEAN DEFAULT false NOT NULL,
  ip_hint TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
