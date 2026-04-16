-- Table: medical_certificates
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.medical_certificates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  certificate_type TEXT DEFAULT 'atestado' NOT NULL,
  content TEXT NOT NULL,
  days_off INTEGER,
  start_date DATE,
  cid_code TEXT,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signature_hash TEXT,
  verification_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  content_hash TEXT,
  server_timestamp TIMESTAMPTZ,
  signed_by_crm TEXT,
  signed_by_name TEXT,
  signed_by_specialty TEXT,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.medical_certificates ADD CONSTRAINT medical_certificates_verification_code_key UNIQUE (verification_code);

ALTER TABLE public.medical_certificates ADD CONSTRAINT medical_certificates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.medical_certificates ADD CONSTRAINT medical_certificates_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.medical_certificates ADD CONSTRAINT medical_certificates_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_medical_certificates_tenant_id ON public.medical_certificates USING btree (tenant_id);
