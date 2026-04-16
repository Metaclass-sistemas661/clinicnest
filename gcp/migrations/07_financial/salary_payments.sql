-- Table: salary_payments
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  reference_month DATE NOT NULL,
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.salary_payments ADD CONSTRAINT salary_payments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.salary_payments ADD CONSTRAINT salary_payments_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_salary_payments_date ON public.salary_payments USING btree (payment_date);

CREATE INDEX idx_salary_payments_professional ON public.salary_payments USING btree (professional_id);

CREATE INDEX idx_salary_payments_status ON public.salary_payments USING btree (status);

CREATE INDEX idx_salary_payments_tenant ON public.salary_payments USING btree (tenant_id);
