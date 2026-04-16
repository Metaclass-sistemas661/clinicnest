-- Table: commission_payments
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.commission_payments (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.commission_payments ADD CONSTRAINT commission_payments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.commission_payments ADD CONSTRAINT commission_payments_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_commission_payments_created ON public.commission_payments USING btree (created_at);

CREATE INDEX idx_commission_payments_professional ON public.commission_payments USING btree (professional_id);

CREATE INDEX idx_commission_payments_tenant ON public.commission_payments USING btree (tenant_id);
