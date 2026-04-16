-- Table: tsa_timestamps
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tsa_timestamps (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  document_type TSA_DOCUMENT_TYPE NOT NULL,
  document_id UUID NOT NULL,
  document_table VARCHAR(100) NOT NULL,
  document_hash TEXT NOT NULL,
  hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
  status TSA_STATUS DEFAULT 'pending' NOT NULL,
  timestamp_token BYTEA,
  timestamp_token_base64 TEXT,
  serial_number VARCHAR(100),
  tsa_time TIMESTAMPTZ,
  tsa_policy_oid VARCHAR(100),
  tsa_provider TSA_PROVIDER,
  tsa_response JSONB,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.tsa_timestamps ADD CONSTRAINT tsa_timestamps_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
