-- ============================================================
-- ClinicaFlow GCP Migration: tabelas adicionais clínicas
-- Cloud SQL PostgreSQL 15+
-- ============================================================

-- Tabela: appointment_cashback_earnings
CREATE TABLE public.appointment_cashback_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    percentage DECIMAL(5,2),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: appointment_package_consumptions
CREATE TABLE public.appointment_package_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
    package_id UUID REFERENCES public.client_packages(id) ON DELETE CASCADE NOT NULL,
    sessions_used INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: client_marketing_preferences
CREATE TABLE public.client_marketing_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email_opt_in BOOLEAN DEFAULT true,
    sms_opt_in BOOLEAN DEFAULT true,
    whatsapp_opt_in BOOLEAN DEFAULT true,
    push_opt_in BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: user_notification_preferences
CREATE TABLE public.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: user_tour_progress
CREATE TABLE public.user_tour_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    tour_id TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, tour_id)
);

-- Enable RLS
ALTER TABLE public.appointment_cashback_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_package_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_marketing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_cashback_earnings_appointment ON public.appointment_cashback_earnings(appointment_id);
CREATE INDEX idx_package_consumptions_appointment ON public.appointment_package_consumptions(appointment_id);
CREATE INDEX idx_client_marketing_prefs_patient ON public.client_marketing_preferences(patient_id);
CREATE INDEX idx_user_notif_prefs_user ON public.user_notification_preferences(user_id);
CREATE INDEX idx_user_tour_progress_user ON public.user_tour_progress(user_id);
