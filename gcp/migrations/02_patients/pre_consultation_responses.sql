-- Table: pre_consultation_responses
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.pre_consultation_responses (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  form_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  responses JSONB DEFAULT '{}' NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.pre_consultation_responses ADD CONSTRAINT pre_consultation_responses_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.pre_consultation_responses ADD CONSTRAINT pre_consultation_responses_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.pre_consultation_responses ADD CONSTRAINT pre_consultation_responses_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES public.pre_consultation_forms(id);
