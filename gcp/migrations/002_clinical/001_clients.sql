-- ============================================================
-- ClinicaFlow GCP Migration: clients (patients)
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    cpf TEXT,
    rg TEXT,
    birth_date DATE,
    gender TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    notes TEXT,
    blood_type TEXT,
    allergies TEXT,
    chronic_conditions TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    marketing_opt_out BOOLEAN DEFAULT false,
    photo_url TEXT,
    access_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_clients_cpf ON public.clients(cpf);
CREATE INDEX idx_clients_name ON public.clients(tenant_id, name);
