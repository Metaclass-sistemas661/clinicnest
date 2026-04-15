-- ============================================================
-- GCP Cloud SQL Migration - Missing Tables (003_financial)
-- 7 tables extracted from Supabase migrations
-- ============================================================

-- Source: 20260215030000_asaas_checkout_sessions.sql
CREATE TABLE IF NOT EXISTS public.asaas_checkout_sessions (
    checkout_session_id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Source: 20260215040000_asaas_webhook_alerts.sql
CREATE TABLE IF NOT EXISTS public.asaas_webhook_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_id UUID,
    event_type TEXT,
    reason TEXT NOT NULL,
    asaas_subscription_id TEXT,
    asaas_payment_id TEXT,
    checkout_session_id TEXT,
    payload JSONB
);

ALTER TABLE public.asaas_webhook_alerts ENABLE ROW LEVEL SECURITY;

-- Source: 20260327700000_financial_notifications_v1.sql
CREATE TABLE IF NOT EXISTS public.commission_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES public.commission_payments(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_response TEXT,
  resolved_by UUID REFERENCES public.profiles(user_id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_disputes ENABLE ROW LEVEL SECURITY;

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE TABLE IF NOT EXISTS public.split_payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    charge_id TEXT NOT NULL,
    provider public.payment_gateway_provider NOT NULL,
    professional_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    split_amount DECIMAL(12,2) NOT NULL,
    clinic_amount DECIMAL(12,2) NOT NULL,
    fee_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    error_message TEXT,
    webhook_received_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.split_payment_logs ENABLE ROW LEVEL SECURITY;

-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
CREATE TABLE IF NOT EXISTS public.tenant_payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider public.payment_gateway_provider NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    webhook_secret_encrypted TEXT,
    environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_split_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    split_fee_payer TEXT DEFAULT 'clinic' CHECK (split_fee_payer IN ('clinic', 'professional', 'split')),
    metadata JSONB DEFAULT '{}',
    last_validated_at TIMESTAMPTZ,
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);

ALTER TABLE public.tenant_payment_gateways ENABLE ROW LEVEL SECURITY;

-- Source: 20260322800000_tiss_glosa_billing_v1.sql
CREATE TABLE IF NOT EXISTS public.tiss_glosa_appeals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiss_guide_id     UUID        NOT NULL REFERENCES public.tiss_guides(id) ON DELETE CASCADE,
  appeal_number     TEXT        NOT NULL,
  justification     TEXT        NOT NULL,
  requested_value   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'pending',
  response_text     TEXT,
  resolved_value    NUMERIC(12,2),
  submitted_at      TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tiss_glosa_appeals ENABLE ROW LEVEL SECURITY;

-- Source: 20260320110000_tiss_guides.sql
CREATE TABLE IF NOT EXISTS public.tiss_guides (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insurance_plan_id UUID       REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
  appointment_id   UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  lot_number       TEXT        NOT NULL,
  guide_number     TEXT        NOT NULL,
  guide_type       TEXT        NOT NULL DEFAULT 'consulta', -- consulta | sadt
  -- status: pending (gerada) | submitted (enviada) | accepted (aceita) | rejected (rejeitada)
  status           TEXT        NOT NULL DEFAULT 'pending',
  xml_content      TEXT,
  tiss_version     TEXT        NOT NULL DEFAULT '3.05.00',
  submitted_at     TIMESTAMPTZ,
  response_code    TEXT,
  response_message TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tiss_guides ENABLE ROW LEVEL SECURITY;

