-- Table: points_wallets
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.points_wallets (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  balance INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.points_wallets ADD CONSTRAINT points_wallets_patient_id_key UNIQUE (patient_id);

ALTER TABLE public.points_wallets ADD CONSTRAINT points_wallets_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.points_wallets ADD CONSTRAINT points_wallets_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_points_wallets_patient ON public.points_wallets USING btree (patient_id);

CREATE INDEX idx_points_wallets_tenant ON public.points_wallets USING btree (tenant_id);
