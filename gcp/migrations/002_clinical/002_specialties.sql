-- ============================================================
-- ClinicaFlow GCP Migration: specialties
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.specialties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_specialties_updated_at
    BEFORE UPDATE ON public.specialties
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_specialties_tenant_id ON public.specialties(tenant_id);
