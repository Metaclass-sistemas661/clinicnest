-- ============================================================
-- ClinicaFlow GCP Migration: professional_commissions, commission_payments
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.professional_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    service_name TEXT,
    service_price DECIMAL(10,2) DEFAULT 0,
    commission_type commission_type DEFAULT 'percentage',
    commission_value DECIMAL(10,2) DEFAULT 0,
    commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payment_method TEXT,
    notes TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES public.procedures(id) ON DELETE CASCADE,
    commission_type commission_type DEFAULT 'percentage',
    commission_value DECIMAL(10,2) DEFAULT 0,
    min_threshold DECIMAL(10,2),
    tier_values JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.salary_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reference_month DATE NOT NULL,
    payment_date DATE,
    payment_method TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_commissions_tenant_id ON public.professional_commissions(tenant_id);
CREATE INDEX idx_commissions_professional ON public.professional_commissions(professional_id);
CREATE INDEX idx_commission_payments_tenant ON public.commission_payments(tenant_id);
CREATE INDEX idx_salary_payments_tenant ON public.salary_payments(tenant_id);
CREATE INDEX idx_commission_rules_tenant ON public.commission_rules(tenant_id);
