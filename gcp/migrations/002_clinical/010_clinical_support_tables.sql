-- ============================================================
-- ClinicaFlow GCP Migration: triage_records, consent_forms,
-- medical_certificates, referrals, schedule_blocks,
-- professional_working_hours, waitlist, medical_record_versions
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.triage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'green',
    chief_complaint TEXT,
    vital_signs JSONB,
    notes TEXT,
    classification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.consent_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    signed_at TIMESTAMPTZ,
    signature_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.medical_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    certificate_type TEXT NOT NULL DEFAULT 'atestado',
    content TEXT NOT NULL,
    days_off INTEGER,
    start_date DATE,
    cid_code TEXT,
    is_signed BOOLEAN DEFAULT false,
    signed_at TIMESTAMPTZ,
    signature_hash TEXT,
    verification_code TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    from_professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    to_specialty TEXT,
    to_professional_name TEXT,
    reason TEXT,
    urgency TEXT DEFAULT 'routine',
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.professional_working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.schedule_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    preferred_dates TEXT,
    priority TEXT DEFAULT 'normal',
    notes TEXT,
    status TEXT DEFAULT 'waiting',
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.medical_record_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES public.medical_records(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    content JSONB NOT NULL,
    changed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all
ALTER TABLE public.triage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_record_versions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_triage_records_tenant_id ON public.triage_records(tenant_id);
CREATE INDEX idx_triage_records_patient_id ON public.triage_records(patient_id);
CREATE INDEX idx_consent_forms_tenant_id ON public.consent_forms(tenant_id);
CREATE INDEX idx_medical_certificates_tenant_id ON public.medical_certificates(tenant_id);
CREATE INDEX idx_referrals_tenant_id ON public.referrals(tenant_id);
CREATE INDEX idx_working_hours_professional ON public.professional_working_hours(professional_id);
CREATE INDEX idx_schedule_blocks_professional ON public.schedule_blocks(professional_id);
CREATE INDEX idx_waitlist_tenant_id ON public.waitlist(tenant_id);
CREATE INDEX idx_medical_record_versions_record ON public.medical_record_versions(record_id);
