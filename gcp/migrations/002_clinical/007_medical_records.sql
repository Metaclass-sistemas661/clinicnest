-- ============================================================
-- ClinicaFlow GCP Migration: medical_records
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    record_type TEXT DEFAULT 'soap',
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    notes TEXT,
    cid_codes TEXT[],
    vital_signs JSONB,
    attachments JSONB,
    is_signed BOOLEAN DEFAULT false,
    signed_at TIMESTAMPTZ,
    signed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_medical_records_updated_at
    BEFORE UPDATE ON public.medical_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_medical_records_tenant_id ON public.medical_records(tenant_id);
CREATE INDEX idx_medical_records_patient_id ON public.medical_records(patient_id);
CREATE INDEX idx_medical_records_professional_id ON public.medical_records(professional_id);
CREATE INDEX idx_medical_records_appointment_id ON public.medical_records(appointment_id);
