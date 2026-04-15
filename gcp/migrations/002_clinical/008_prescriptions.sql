-- ============================================================
-- ClinicaFlow GCP Migration: prescriptions
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    medications JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    is_controlled BOOLEAN DEFAULT false,
    is_signed BOOLEAN DEFAULT false,
    signed_at TIMESTAMPTZ,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_prescriptions_updated_at
    BEFORE UPDATE ON public.prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_prescriptions_tenant_id ON public.prescriptions(tenant_id);
CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions(patient_id);
