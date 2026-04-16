-- Table: points_ledger
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.points_ledger (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  wallet_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_wallet_id_fkey
  FOREIGN KEY (wallet_id) REFERENCES public.points_wallets(id);

ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_points_ledger_wallet ON public.points_ledger USING btree (wallet_id);
