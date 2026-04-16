-- Table: patient_activity_log
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_activity_log (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  patient_user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_description TEXT,
  metadata JSONB DEFAULT '{}',
  ip_hint TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
