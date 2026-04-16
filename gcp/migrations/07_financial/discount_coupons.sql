-- Table: discount_coupons
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  valid_until DATE,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.discount_coupons ADD CONSTRAINT discount_coupons_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_discount_coupons_code ON public.discount_coupons USING btree (tenant_id, code);

CREATE INDEX idx_discount_coupons_tenant ON public.discount_coupons USING btree (tenant_id);
