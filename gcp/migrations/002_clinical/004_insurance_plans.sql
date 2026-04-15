-- ============================================================
-- ClinicaFlow GCP Migration: insurance_plans
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.insurance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    ans_code TEXT,
    contact_phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_insurance_plans_updated_at
    BEFORE UPDATE ON public.insurance_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_insurance_plans_tenant_id ON public.insurance_plans(tenant_id);
