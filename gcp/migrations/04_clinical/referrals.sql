-- Table: referrals
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  from_professional_id UUID,
  to_specialty TEXT,
  to_professional_name TEXT,
  reason TEXT,
  urgency TEXT DEFAULT 'routine',
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.referrals ADD CONSTRAINT referrals_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.referrals ADD CONSTRAINT referrals_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.referrals ADD CONSTRAINT referrals_from_professional_id_fkey
  FOREIGN KEY (from_professional_id) REFERENCES public.profiles(id);

CREATE INDEX idx_referrals_tenant_id ON public.referrals USING btree (tenant_id);
