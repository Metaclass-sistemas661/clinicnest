-- ============================================================
-- ClinicaFlow GCP Migration: appointments
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
    insurance_plan_id UUID REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status appointment_status NOT NULL DEFAULT 'pending',
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    commission_amount DECIMAL(10,2),
    consultation_type TEXT,
    insurance_authorization TEXT,
    cid_code TEXT,
    notes TEXT,
    telemedicine BOOLEAN DEFAULT false,
    telemedicine_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX idx_appointments_professional_id ON public.appointments(professional_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);
