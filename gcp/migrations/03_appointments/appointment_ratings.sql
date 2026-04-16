-- Table: appointment_ratings
-- Domain: 03_appointments
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.appointment_ratings (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.appointment_ratings ADD CONSTRAINT appointment_ratings_appointment_id_key UNIQUE (appointment_id);

ALTER TABLE public.appointment_ratings ADD CONSTRAINT appointment_ratings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.appointment_ratings ADD CONSTRAINT appointment_ratings_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);
