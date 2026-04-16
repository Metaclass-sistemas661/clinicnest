-- Table: ai_usage_log
-- Domain: 12_ai
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  feature TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (id)
);

ALTER TABLE public.ai_usage_log ADD CONSTRAINT ai_usage_log_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
