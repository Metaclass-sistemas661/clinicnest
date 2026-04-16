-- Table: professional_commissions
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.professional_commissions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  appointment_id UUID,
  service_name TEXT,
  service_price NUMERIC DEFAULT 0,
  commission_type COMMISSION_TYPE DEFAULT 'percentage',
  commission_value NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.professional_commissions ADD CONSTRAINT professional_commissions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.professional_commissions ADD CONSTRAINT professional_commissions_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.professional_commissions ADD CONSTRAINT professional_commissions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE INDEX idx_commissions_professional ON public.professional_commissions USING btree (professional_id);

CREATE INDEX idx_commissions_tenant_id ON public.professional_commissions USING btree (tenant_id);

CREATE INDEX idx_professional_commissions_tenant ON public.professional_commissions USING btree (tenant_id);
