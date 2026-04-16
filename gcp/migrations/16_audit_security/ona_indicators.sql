-- Table: ona_indicators
-- Domain: 16_audit_security
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.ona_indicators (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  indicator_code TEXT NOT NULL,
  indicator_name TEXT NOT NULL,
  value NUMERIC,
  target_value NUMERIC,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.ona_indicators ADD CONSTRAINT ona_indicators_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
