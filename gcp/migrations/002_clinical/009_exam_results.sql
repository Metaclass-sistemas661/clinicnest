-- ============================================================
-- ClinicaFlow GCP Migration: exam_results
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    exam_type TEXT NOT NULL,
    exam_date DATE,
    results JSONB,
    file_url TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_exam_results_updated_at
    BEFORE UPDATE ON public.exam_results
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_exam_results_tenant_id ON public.exam_results(tenant_id);
CREATE INDEX idx_exam_results_patient_id ON public.exam_results(patient_id);
