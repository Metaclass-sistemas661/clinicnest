-- Table: consent_signing_tokens
-- Domain: 11_consent_documents
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.consent_signing_tokens (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  token TEXT NOT NULL,
  template_ids UUID[] DEFAULT '{}' NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.consent_signing_tokens ADD CONSTRAINT consent_signing_tokens_token_key UNIQUE (token);

ALTER TABLE public.consent_signing_tokens ADD CONSTRAINT consent_signing_tokens_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.consent_signing_tokens ADD CONSTRAINT consent_signing_tokens_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);
