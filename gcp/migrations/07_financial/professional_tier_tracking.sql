-- Table: professional_tier_tracking
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.professional_tier_tracking (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  rule_id UUID NOT NULL,
  current_tier_index INTEGER DEFAULT 0 NOT NULL,
  current_tier_value NUMERIC DEFAULT 0 NOT NULL,
  monthly_revenue NUMERIC DEFAULT 0 NOT NULL,
  last_checked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.professional_tier_tracking ADD CONSTRAINT professional_tier_tracking_tenant_id_professional_id_rule_i_key UNIQUE (tenant_id, professional_id, rule_id);

ALTER TABLE public.professional_tier_tracking ADD CONSTRAINT professional_tier_tracking_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.professional_tier_tracking ADD CONSTRAINT professional_tier_tracking_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(user_id);

ALTER TABLE public.professional_tier_tracking ADD CONSTRAINT professional_tier_tracking_rule_id_fkey
  FOREIGN KEY (rule_id) REFERENCES public.commission_rules(id);
