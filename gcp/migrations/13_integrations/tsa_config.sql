-- Table: tsa_config
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tsa_config (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  provider TSA_PROVIDER DEFAULT 'certisign' NOT NULL,
  api_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  certificate_path TEXT,
  certificate_password_encrypted TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  policy_oid VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  last_test_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.tsa_config ADD CONSTRAINT tsa_config_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.tsa_config ADD CONSTRAINT tsa_config_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
