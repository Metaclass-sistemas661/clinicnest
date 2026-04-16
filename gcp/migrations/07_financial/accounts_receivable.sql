-- Table: accounts_receivable
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  amount_due NUMERIC DEFAULT 0 NOT NULL,
  amount_paid NUMERIC DEFAULT 0 NOT NULL,
  client_id UUID,
  installments INTEGER DEFAULT 1,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  professional_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.accounts_receivable ADD CONSTRAINT accounts_receivable_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_accounts_receivable_tenant ON public.accounts_receivable USING btree (tenant_id);
