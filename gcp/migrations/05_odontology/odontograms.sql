-- Table: odontograms
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.odontograms (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.odontograms ADD CONSTRAINT odontograms_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.odontograms ADD CONSTRAINT odontograms_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.odontograms ADD CONSTRAINT odontograms_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_odontograms_patient ON public.odontograms USING btree (patient_id);

CREATE INDEX idx_odontograms_tenant_patient ON public.odontograms USING btree (tenant_id, patient_id);
