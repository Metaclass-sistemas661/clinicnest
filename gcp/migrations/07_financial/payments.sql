-- Table: payments
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL,
  payment_method_id UUID,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'confirmed',
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.payments ADD CONSTRAINT payments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.payments ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id);

ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_id_fkey
  FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);

CREATE INDEX idx_payments_order ON public.payments USING btree (order_id);

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id);

CREATE INDEX idx_payments_tenant ON public.payments USING btree (tenant_id);
