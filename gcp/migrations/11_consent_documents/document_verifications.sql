-- Table: document_verifications
-- Domain: 11_consent_documents
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.document_verifications (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  document_type VERIFIABLE_DOCUMENT_TYPE NOT NULL,
  document_id UUID NOT NULL,
  document_hash TEXT NOT NULL,
  verification_result BOOLEAN NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  verifier_ip INET,
  verifier_user_agent TEXT,
  tenant_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.document_verifications ADD CONSTRAINT document_verifications_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
