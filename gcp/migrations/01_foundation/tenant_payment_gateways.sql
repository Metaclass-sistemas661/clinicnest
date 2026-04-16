-- Table: tenant_payment_gateways
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tenant_payment_gateways (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  provider PAYMENT_GATEWAY_PROVIDER NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  webhook_secret_encrypted TEXT,
  environment TEXT DEFAULT 'sandbox' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_split_enabled BOOLEAN DEFAULT false NOT NULL,
  split_fee_payer TEXT DEFAULT 'clinic',
  metadata JSONB DEFAULT '{}',
  last_validated_at TIMESTAMPTZ,
  validation_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.tenant_payment_gateways ADD CONSTRAINT tenant_payment_gateways_tenant_id_provider_key UNIQUE (tenant_id, provider);

ALTER TABLE public.tenant_payment_gateways ADD CONSTRAINT tenant_payment_gateways_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
