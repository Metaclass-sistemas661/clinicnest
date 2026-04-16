-- Table: loyalty_tiers
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  min_points INTEGER DEFAULT 0 NOT NULL,
  cashback_percent NUMERIC DEFAULT 0,
  benefits JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.loyalty_tiers ADD CONSTRAINT loyalty_tiers_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_loyalty_tiers_tenant ON public.loyalty_tiers USING btree (tenant_id);
