-- Table: patient_proms
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_proms (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  questionnaire_type TEXT NOT NULL,
  responses JSONB NOT NULL,
  score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_proms ADD CONSTRAINT patient_proms_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_proms ADD CONSTRAINT patient_proms_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_proms_patient ON public.patient_proms USING btree (patient_id, created_at DESC);

CREATE INDEX idx_proms_tenant ON public.patient_proms USING btree (tenant_id, created_at DESC);
