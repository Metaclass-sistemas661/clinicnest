-- Table: vouchers
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT DEFAULT 'ativo' NOT NULL,
  valor NUMERIC DEFAULT 0 NOT NULL,
  service_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.procedures(id);

CREATE INDEX idx_vouchers_code ON public.vouchers USING btree (tenant_id, code);

CREATE INDEX idx_vouchers_status ON public.vouchers USING btree (tenant_id, status);

CREATE INDEX idx_vouchers_tenant ON public.vouchers USING btree (tenant_id);
