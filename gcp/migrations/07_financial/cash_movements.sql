-- Table: cash_movements
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  reason TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.cash_sessions(id);

CREATE INDEX idx_cash_movements_session ON public.cash_movements USING btree (session_id, created_at DESC);

CREATE INDEX idx_cash_movements_tenant ON public.cash_movements USING btree (tenant_id, created_at DESC);
