-- Table: financial_transactions
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  type TRANSACTION_TYPE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE NOT NULL,
  payment_method TEXT,
  cost_center_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.financial_transactions ADD CONSTRAINT financial_transactions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.financial_transactions ADD CONSTRAINT financial_transactions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE INDEX idx_financial_transactions_date ON public.financial_transactions USING btree (transaction_date);

CREATE INDEX idx_financial_transactions_tenant_id ON public.financial_transactions USING btree (tenant_id);

CREATE INDEX idx_financial_transactions_tenant_transaction_date ON public.financial_transactions USING btree (tenant_id, transaction_date DESC);

CREATE INDEX idx_financial_transactions_tenant_type_date ON public.financial_transactions USING btree (tenant_id, type, transaction_date DESC);

CREATE INDEX idx_financial_transactions_type ON public.financial_transactions USING btree (type);
