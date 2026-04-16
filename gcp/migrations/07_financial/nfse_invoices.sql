-- Table: nfse_invoices
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.nfse_invoices (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  appointment_id UUID,
  invoice_number TEXT,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  xml_content TEXT,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.nfse_invoices ADD CONSTRAINT nfse_invoices_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.nfse_invoices ADD CONSTRAINT nfse_invoices_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.nfse_invoices ADD CONSTRAINT nfse_invoices_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE INDEX idx_nfse_invoices_tenant ON public.nfse_invoices USING btree (tenant_id);
