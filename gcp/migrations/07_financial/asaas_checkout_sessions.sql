-- Table: asaas_checkout_sessions
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.asaas_checkout_sessions (
  checkout_session_id TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (checkout_session_id)
);

ALTER TABLE public.asaas_checkout_sessions ADD CONSTRAINT asaas_checkout_sessions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX asaas_checkout_sessions_tenant_id_idx ON public.asaas_checkout_sessions USING btree (tenant_id);
