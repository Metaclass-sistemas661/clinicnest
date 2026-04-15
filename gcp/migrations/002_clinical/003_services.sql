-- ============================================================
-- ClinicaFlow GCP Migration: services (procedures)
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    commission_type commission_type,
    commission_value DECIMAL(10,2) DEFAULT 0,
    category TEXT,
    tuss_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    requires_authorization BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_services_tenant_id ON public.services(tenant_id);
