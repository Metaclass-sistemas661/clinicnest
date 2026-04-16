-- Table: appointment_cashback_earnings
-- Domain: 03_appointments
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.appointment_cashback_earnings (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  percentage NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  client_id UUID NOT NULL,
  earned_amount NUMERIC NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.appointment_cashback_earnings ADD CONSTRAINT appointment_cashback_earnings_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

CREATE INDEX idx_cashback_earnings_appointment ON public.appointment_cashback_earnings USING btree (appointment_id);
