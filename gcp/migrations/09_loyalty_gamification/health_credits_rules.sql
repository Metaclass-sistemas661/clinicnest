-- Table: health_credits_rules
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.health_credits_rules (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  points INTEGER DEFAULT 10 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.health_credits_rules ADD CONSTRAINT health_credits_rules_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_health_credits_rules_tenant ON public.health_credits_rules USING btree (tenant_id, is_active);
