-- Table: patient_onboarding
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_onboarding (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  patient_user_id UUID NOT NULL,
  tour_completed BOOLEAN DEFAULT false NOT NULL,
  tour_completed_at TIMESTAMPTZ,
  tour_skipped BOOLEAN DEFAULT false NOT NULL,
  first_login_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_login_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  login_count INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_onboarding ADD CONSTRAINT patient_onboarding_patient_user_id_key UNIQUE (patient_user_id);
