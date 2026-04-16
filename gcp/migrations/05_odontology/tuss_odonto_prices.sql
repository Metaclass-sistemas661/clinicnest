-- Table: tuss_odonto_prices
-- Domain: 05_odontology
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tuss_odonto_prices (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  tuss_code TEXT NOT NULL,
  description TEXT NOT NULL,
  default_price NUMERIC DEFAULT 0 NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.tuss_odonto_prices ADD CONSTRAINT tuss_odonto_prices_tenant_id_tuss_code_key UNIQUE (tenant_id, tuss_code);

ALTER TABLE public.tuss_odonto_prices ADD CONSTRAINT tuss_odonto_prices_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
