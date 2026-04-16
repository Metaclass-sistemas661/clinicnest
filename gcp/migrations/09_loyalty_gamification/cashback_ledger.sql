-- Table: cashback_ledger
-- Domain: 09_loyalty_gamification
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.cashback_ledger (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  wallet_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  appointment_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  actor_user_id UUID,
  client_id UUID NOT NULL,
  delta_amount NUMERIC NOT NULL,
  notes TEXT,
  order_id UUID,
  reason CASHBACK_LEDGER_REASON NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.cashback_ledger ADD CONSTRAINT cashback_ledger_wallet_id_fkey
  FOREIGN KEY (wallet_id) REFERENCES public.cashback_wallets(id);

ALTER TABLE public.cashback_ledger ADD CONSTRAINT cashback_ledger_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.cashback_ledger ADD CONSTRAINT cashback_ledger_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.cashback_ledger ADD CONSTRAINT cashback_ledger_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.cashback_ledger ADD CONSTRAINT cashback_ledger_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id);

CREATE INDEX idx_cashback_ledger_client ON public.cashback_ledger USING btree (tenant_id, client_id, created_at DESC);
