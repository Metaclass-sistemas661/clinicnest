-- ============================================================
-- ClinicaFlow GCP Migration: tenants
-- Cloud SQL PostgreSQL 15+
-- ============================================================

CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    cnpj TEXT,
    cpf TEXT,
    logo_url TEXT,
    website TEXT,
    whatsapp_api_url TEXT,
    whatsapp_api_key TEXT,
    whatsapp_instance TEXT,
    enabled_modules TEXT[] DEFAULT '{}',
    simple_mode BOOLEAN DEFAULT false,
    reply_to_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tenants_email ON public.tenants(email);
