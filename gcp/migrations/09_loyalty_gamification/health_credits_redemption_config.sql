-- Table: health_credits_redemption_config
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.health_credits_redemption_config (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  credits_per_real NUMERIC DEFAULT 10 NOT NULL,
  min_redeem INTEGER DEFAULT 50 NOT NULL,
  max_discount_percent NUMERIC DEFAULT 20 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.health_credits_redemption_config ADD CONSTRAINT health_credits_redemption_config_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE public.health_credits_redemption_config ADD CONSTRAINT health_credits_redemption_config_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
