-- ============================================================
-- ClinicaFlow GCP Migration: odontograms, periograms, dental
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.odontograms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.odontogram_teeth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    odontogram_id UUID REFERENCES public.odontograms(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    tooth_number INTEGER NOT NULL,
    status TEXT DEFAULT 'healthy',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.odontogram_tooth_surfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tooth_id UUID REFERENCES public.odontogram_teeth(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    surface TEXT NOT NULL,
    condition TEXT DEFAULT 'healthy',
    procedure_done TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.odontogram_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    odontogram_id UUID REFERENCES public.odontograms(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    tooth_number INTEGER,
    annotation_type TEXT,
    content TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dental_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    image_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    tooth_number INTEGER,
    notes TEXT,
    taken_at TIMESTAMPTZ DEFAULT now(),
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.periograms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.periogram_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periogram_id UUID REFERENCES public.periograms(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    tooth_number INTEGER NOT NULL,
    site TEXT NOT NULL,
    probing_depth INTEGER,
    gingival_margin INTEGER,
    bleeding BOOLEAN DEFAULT false,
    plaque BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'proposed',
    total_cost DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.treatment_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES public.treatment_plans(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    tooth_number INTEGER,
    surface TEXT,
    procedure_name TEXT NOT NULL,
    procedure_code TEXT,
    cost DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'planned',
    completed_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.odontograms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_teeth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_tooth_surfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odontogram_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periograms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periogram_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_odontograms_patient ON public.odontograms(patient_id);
CREATE INDEX idx_odontogram_teeth_odontogram ON public.odontogram_teeth(odontogram_id);
CREATE INDEX idx_dental_images_patient ON public.dental_images(patient_id);
CREATE INDEX idx_periograms_patient ON public.periograms(patient_id);
CREATE INDEX idx_treatment_plans_patient ON public.treatment_plans(patient_id);
