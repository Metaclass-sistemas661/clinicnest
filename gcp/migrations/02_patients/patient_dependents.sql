-- Table: patient_dependents
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_dependents (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  guardian_patient_id UUID NOT NULL,
  dependent_patient_id UUID NOT NULL,
  relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_dependents ADD CONSTRAINT patient_dependents_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_dependents ADD CONSTRAINT patient_dependents_guardian_patient_id_fkey
  FOREIGN KEY (guardian_patient_id) REFERENCES public.patients(id);

ALTER TABLE public.patient_dependents ADD CONSTRAINT patient_dependents_dependent_patient_id_fkey
  FOREIGN KEY (dependent_patient_id) REFERENCES public.patients(id);
