-- Table: periograms
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.periograms (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.periograms ADD CONSTRAINT periograms_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.periograms ADD CONSTRAINT periograms_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.periograms ADD CONSTRAINT periograms_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_periograms_patient ON public.periograms USING btree (patient_id);
