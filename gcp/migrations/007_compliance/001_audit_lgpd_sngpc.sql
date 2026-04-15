-- ============================================================
-- ClinicaFlow GCP Migration: compliance (LGPD, audit, ONA, SNGPC)
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    before_data JSONB,
    after_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lgpd_data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lgpd_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    data_category TEXT NOT NULL,
    retention_years INTEGER NOT NULL DEFAULT 20,
    legal_basis TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.adverse_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    reported_by UUID,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    root_cause TEXT,
    corrective_actions TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ona_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    indicator_code TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    value DECIMAL(10,4),
    target_value DECIMAL(10,4),
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sngpc_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    substance_name TEXT NOT NULL,
    quantity DECIMAL(10,4) NOT NULL,
    unit TEXT DEFAULT 'comprimido',
    batch_number TEXT,
    expiry_date DATE,
    last_updated TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sngpc_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    estoque_id UUID REFERENCES public.sngpc_estoque(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    quantity DECIMAL(10,4) NOT NULL,
    prescription_id UUID,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    professional_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sngpc_transmissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    xml_content TEXT,
    response TEXT,
    transmitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adverse_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ona_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sngpc_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sngpc_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sngpc_transmissoes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);
CREATE INDEX idx_admin_audit_logs_tenant ON public.admin_audit_logs(tenant_id);
CREATE INDEX idx_lgpd_requests_tenant ON public.lgpd_data_requests(tenant_id);
CREATE INDEX idx_adverse_events_tenant ON public.adverse_events(tenant_id);
CREATE INDEX idx_sngpc_estoque_tenant ON public.sngpc_estoque(tenant_id);
