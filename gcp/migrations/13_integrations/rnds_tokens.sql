-- Table: rnds_tokens
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.rnds_tokens (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  access_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.rnds_tokens ADD CONSTRAINT rnds_tokens_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.rnds_tokens ADD CONSTRAINT rnds_tokens_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
