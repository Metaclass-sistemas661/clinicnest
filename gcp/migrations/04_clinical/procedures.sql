-- Table: procedures
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.procedures (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30 NOT NULL,
  price NUMERIC DEFAULT 0 NOT NULL,
  cost NUMERIC DEFAULT 0,
  commission_type COMMISSION_TYPE,
  commission_value NUMERIC DEFAULT 0,
  category TEXT,
  tuss_code TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  requires_authorization BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.procedures ADD CONSTRAINT services_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_services_tenant_id ON public.procedures USING btree (tenant_id);
