-- Table: document_signatures
-- Domain: 11_consent_documents
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.document_signatures (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  signature_method TEXT NOT NULL,
  signature_path TEXT,
  facial_photo_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.document_signatures ADD CONSTRAINT document_signatures_patient_id_document_type_document_id_key UNIQUE (patient_id, document_type, document_id);

ALTER TABLE public.document_signatures ADD CONSTRAINT document_signatures_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.document_signatures ADD CONSTRAINT document_signatures_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);
