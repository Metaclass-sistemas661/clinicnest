-- Table: profile_certificates
-- Domain: 11_consent_documents
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.profile_certificates (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  profile_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  certificate_type CERTIFICATE_TYPE DEFAULT 'A1' NOT NULL,
  common_name TEXT NOT NULL,
  cpf_cnpj TEXT,
  issuer TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  not_before TIMESTAMPTZ NOT NULL,
  not_after TIMESTAMPTZ NOT NULL,
  thumbprint TEXT NOT NULL,
  encrypted_pfx BYTEA,
  encryption_iv BYTEA,
  encryption_salt BYTEA,
  a3_thumbprint TEXT,
  cloud_provider TEXT,
  cloud_credential_id TEXT,
  cloud_access_token TEXT,
  cloud_refresh_token TEXT,
  cloud_token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  PRIMARY KEY (id)
);

ALTER TABLE public.profile_certificates ADD CONSTRAINT unique_profile_thumbprint UNIQUE (profile_id, thumbprint);

ALTER TABLE public.profile_certificates ADD CONSTRAINT profile_certificates_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id);

ALTER TABLE public.profile_certificates ADD CONSTRAINT profile_certificates_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
