-- ============================================================
-- ClinicaFlow GCP Migration: patient_portal tables
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    access_code TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    template_id UUID,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'pending',
    signed_at TIMESTAMPTZ,
    signature_url TEXT,
    photo_url TEXT,
    sealed_pdf_url TEXT,
    ip_address TEXT,
    user_agent TEXT,
    consent_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.consent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    requires_photo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_dependents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    guardian_patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    dependent_patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    relationship TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    due_date DATE,
    paid_at TIMESTAMPTZ,
    description TEXT,
    external_payment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.patient_invoices(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT,
    external_id TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('patient_to_clinic', 'clinic_to_patient')),
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_vaccinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    vaccine_name TEXT NOT NULL,
    dose TEXT,
    administered_at DATE,
    lot_number TEXT,
    manufacturer TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_proms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    questionnaire_type TEXT NOT NULL,
    responses JSONB NOT NULL,
    score DECIMAL(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    achievement_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_proms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_achievements ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_patient_profiles_tenant ON public.patient_profiles(tenant_id);
CREATE INDEX idx_patient_profiles_patient ON public.patient_profiles(patient_id);
CREATE INDEX idx_patient_consents_tenant ON public.patient_consents(tenant_id);
CREATE INDEX idx_patient_consents_patient ON public.patient_consents(patient_id);
CREATE INDEX idx_patient_notifications_patient ON public.patient_notifications(patient_id);
CREATE INDEX idx_patient_invoices_patient ON public.patient_invoices(patient_id);
CREATE INDEX idx_patient_messages_patient ON public.patient_messages(patient_id);
