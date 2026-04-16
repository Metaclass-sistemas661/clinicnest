-- Table: health_credits_balance
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.health_credits_balance (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  balance INTEGER DEFAULT 0 NOT NULL,
  lifetime_earned INTEGER DEFAULT 0 NOT NULL,
  lifetime_redeemed INTEGER DEFAULT 0 NOT NULL,
  tier TEXT DEFAULT 'bronze' NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.health_credits_balance ADD CONSTRAINT health_credits_balance_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);

ALTER TABLE public.health_credits_balance ADD CONSTRAINT health_credits_balance_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.health_credits_balance ADD CONSTRAINT health_credits_balance_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_health_credits_balance_tenant_patient ON public.health_credits_balance USING btree (tenant_id, patient_id);
