-- Table: consent_forms
-- Domain: 11_consent_documents
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.consent_forms (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.consent_forms ADD CONSTRAINT consent_forms_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.consent_forms ADD CONSTRAINT consent_forms_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_consent_forms_tenant_id ON public.consent_forms USING btree (tenant_id);
