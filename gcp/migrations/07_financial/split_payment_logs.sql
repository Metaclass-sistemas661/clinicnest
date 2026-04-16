-- Table: split_payment_logs
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.split_payment_logs (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID,
  charge_id TEXT NOT NULL,
  provider PAYMENT_GATEWAY_PROVIDER NOT NULL,
  professional_id UUID,
  total_amount NUMERIC NOT NULL,
  split_amount NUMERIC NOT NULL,
  clinic_amount NUMERIC NOT NULL,
  fee_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' NOT NULL,
  error_message TEXT,
  webhook_received_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.split_payment_logs ADD CONSTRAINT split_payment_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.split_payment_logs ADD CONSTRAINT split_payment_logs_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.split_payment_logs ADD CONSTRAINT split_payment_logs_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(user_id);
