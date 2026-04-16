-- Table: bills_receivable
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.bills_receivable (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  received_at DATE,
  status TEXT DEFAULT 'pending',
  patient_id UUID,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  client_id UUID,
  created_by UUID,
  notes TEXT,
  payment_method TEXT,
  received_amount NUMERIC,
  PRIMARY KEY (id)
);

ALTER TABLE public.bills_receivable ADD CONSTRAINT bills_receivable_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.bills_receivable ADD CONSTRAINT bills_receivable_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.bills_receivable ADD CONSTRAINT bills_receivable_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.bills_receivable ADD CONSTRAINT bills_receivable_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);

CREATE INDEX idx_bills_receivable_tenant ON public.bills_receivable USING btree (tenant_id);
