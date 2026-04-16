-- Table: cash_sessions
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  opened_by UUID,
  closed_by UUID,
  opening_balance NUMERIC DEFAULT 0 NOT NULL,
  closing_balance NUMERIC,
  opened_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  closing_balance_expected NUMERIC,
  closing_balance_reported NUMERIC,
  closing_difference NUMERIC,
  closing_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  opening_notes TEXT,
  status CASH_SESSION_STATUS DEFAULT 'open' NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.cash_sessions ADD CONSTRAINT cash_sessions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.cash_sessions ADD CONSTRAINT cash_sessions_opened_by_fkey
  FOREIGN KEY (opened_by) REFERENCES public.profiles(id);

ALTER TABLE public.cash_sessions ADD CONSTRAINT cash_sessions_closed_by_fkey
  FOREIGN KEY (closed_by) REFERENCES public.profiles(id);

CREATE INDEX idx_cash_sessions_tenant_created ON public.cash_sessions USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_cash_sessions_tenant_id ON public.cash_sessions USING btree (tenant_id);

CREATE UNIQUE INDEX ux_cash_sessions_open_per_tenant ON public.cash_sessions USING btree (tenant_id) WHERE (status = 'open'::cash_session_status);
