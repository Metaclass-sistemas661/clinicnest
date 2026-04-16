-- Table: patient_vaccinations
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_vaccinations (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  vaccine_name TEXT NOT NULL,
  dose TEXT,
  administered_at DATE,
  lot_number TEXT,
  manufacturer TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_vaccinations ADD CONSTRAINT patient_vaccinations_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_vaccinations ADD CONSTRAINT patient_vaccinations_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);
