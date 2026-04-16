-- Table: profiles
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  professional_type TEXT,
  council_type TEXT,
  council_number TEXT,
  council_state TEXT,
  specialty TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);

CREATE INDEX idx_profiles_tenant_id ON public.profiles USING btree (tenant_id);

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);
