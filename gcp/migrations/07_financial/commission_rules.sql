-- Table: commission_rules
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  procedure_id UUID,
  commission_type COMMISSION_TYPE DEFAULT 'percentage',
  commission_value NUMERIC DEFAULT 0,
  min_threshold NUMERIC,
  tier_values JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.commission_rules ADD CONSTRAINT commission_rules_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.commission_rules ADD CONSTRAINT commission_rules_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.commission_rules ADD CONSTRAINT commission_rules_service_id_fkey
  FOREIGN KEY (procedure_id) REFERENCES public.procedures(id);

CREATE INDEX idx_commission_rules_tenant ON public.commission_rules USING btree (tenant_id);
