-- Table: patient_consents
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_consents (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  template_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  photo_url TEXT,
  sealed_pdf_url TEXT,
  ip_address TEXT,
  user_agent TEXT,
  consent_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_consents ADD CONSTRAINT patient_consents_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_consents ADD CONSTRAINT patient_consents_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_patient_consents_patient ON public.patient_consents USING btree (patient_id);

CREATE INDEX idx_patient_consents_tenant ON public.patient_consents USING btree (tenant_id);
