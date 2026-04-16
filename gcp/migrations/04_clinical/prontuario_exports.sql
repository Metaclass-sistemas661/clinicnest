-- Table: prontuario_exports
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.prontuario_exports (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  client_name VARCHAR(200) NOT NULL,
  client_cpf VARCHAR(14),
  include_prontuarios BOOLEAN DEFAULT true,
  include_receituarios BOOLEAN DEFAULT true,
  include_atestados BOOLEAN DEFAULT true,
  include_laudos BOOLEAN DEFAULT true,
  include_evolucoes BOOLEAN DEFAULT true,
  include_exames BOOLEAN DEFAULT true,
  include_anexos BOOLEAN DEFAULT true,
  data_inicio DATE,
  data_fim DATE,
  pdf_url TEXT,
  pdf_size_bytes INTEGER,
  xml_url TEXT,
  xml_size_bytes INTEGER,
  zip_url TEXT,
  zip_size_bytes INTEGER,
  content_hash TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  tsa_timestamp_id UUID,
  status VARCHAR(20) DEFAULT 'processing',
  error_message TEXT,
  requested_by UUID,
  requested_reason TEXT,
  download_count INTEGER DEFAULT 0,
  last_download_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.prontuario_exports ADD CONSTRAINT prontuario_exports_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.prontuario_exports ADD CONSTRAINT prontuario_exports_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.prontuario_exports ADD CONSTRAINT prontuario_exports_tsa_timestamp_id_fkey
  FOREIGN KEY (tsa_timestamp_id) REFERENCES public.tsa_timestamps(id);
