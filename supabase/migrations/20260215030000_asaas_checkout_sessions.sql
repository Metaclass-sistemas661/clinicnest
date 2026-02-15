CREATE TABLE IF NOT EXISTS public.asaas_checkout_sessions (
    checkout_session_id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asaas_checkout_sessions_tenant_id_idx
ON public.asaas_checkout_sessions(tenant_id);
