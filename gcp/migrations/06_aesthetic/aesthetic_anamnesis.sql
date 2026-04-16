-- Table: aesthetic_anamnesis
-- Domain: 06_aesthetic
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.aesthetic_anamnesis (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  fitzpatrick TEXT DEFAULT '',
  skin_type TEXT DEFAULT '',
  allergies TEXT DEFAULT '',
  isotretinoin BOOLEAN DEFAULT false,
  pregnant BOOLEAN DEFAULT false,
  previous_procedures TEXT DEFAULT '',
  expectations TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.aesthetic_anamnesis ADD CONSTRAINT aesthetic_anamnesis_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);

ALTER TABLE public.aesthetic_anamnesis ADD CONSTRAINT aesthetic_anamnesis_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.aesthetic_anamnesis ADD CONSTRAINT aesthetic_anamnesis_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_aesthetic_anamnesis_patient ON public.aesthetic_anamnesis USING btree (tenant_id, patient_id);
