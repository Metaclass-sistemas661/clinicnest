-- Table: payment_methods
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'other' NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  code TEXT,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id)
);

ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_tenant_id_code_key UNIQUE (tenant_id, code);

ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_payment_methods_tenant ON public.payment_methods USING btree (tenant_id);
