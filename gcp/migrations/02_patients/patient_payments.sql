-- Table: patient_payments
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_payments (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  invoice_id UUID,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  external_id TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_payments ADD CONSTRAINT patient_payments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_payments ADD CONSTRAINT patient_payments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.patient_payments ADD CONSTRAINT patient_payments_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.patient_invoices(id);
