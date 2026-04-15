-- ============================================================
-- ClinicaFlow GCP Migration: HL7, RNDS, webhooks
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.hl7_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 2575,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_types TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    auth_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hl7_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES public.hl7_connections(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    hl7_field TEXT NOT NULL,
    local_table TEXT NOT NULL,
    local_column TEXT NOT NULL,
    transform TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hl7_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    connection_id UUID REFERENCES public.hl7_connections(id) ON DELETE SET NULL,
    direction TEXT NOT NULL,
    message_type TEXT,
    raw_message TEXT,
    status TEXT DEFAULT 'received',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rnds_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    certificate_data TEXT NOT NULL,
    password_hash TEXT,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rnds_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    fhir_bundle TEXT,
    status TEXT DEFAULT 'pending',
    response TEXT,
    rnds_id TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rnds_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
    access_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.nfse_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    invoice_number TEXT,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    external_id TEXT,
    xml_content TEXT,
    pdf_url TEXT,
    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.asaas_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hl7_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hl7_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hl7_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnds_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnds_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnds_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_hl7_connections_tenant ON public.hl7_connections(tenant_id);
CREATE INDEX idx_hl7_message_log_tenant ON public.hl7_message_log(tenant_id);
CREATE INDEX idx_rnds_submissions_tenant ON public.rnds_submissions(tenant_id);
CREATE INDEX idx_nfse_invoices_tenant ON public.nfse_invoices(tenant_id);
CREATE INDEX idx_asaas_events_type ON public.asaas_webhook_events(event_type);
CREATE INDEX idx_stripe_events_type ON public.stripe_webhook_events(event_type);
