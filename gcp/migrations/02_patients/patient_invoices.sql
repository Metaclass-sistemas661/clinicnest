-- Table: patient_invoices
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_invoices (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  description TEXT,
  external_payment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_invoices ADD CONSTRAINT patient_invoices_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_invoices ADD CONSTRAINT patient_invoices_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_patient_invoices_patient ON public.patient_invoices USING btree (patient_id);
