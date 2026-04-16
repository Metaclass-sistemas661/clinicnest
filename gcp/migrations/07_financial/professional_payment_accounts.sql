-- Table: professional_payment_accounts
-- Domain: 07_financial
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.professional_payment_accounts (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  gateway_id UUID NOT NULL,
  provider PAYMENT_GATEWAY_PROVIDER NOT NULL,
  recipient_id TEXT,
  wallet_id TEXT,
  account_id TEXT,
  pix_key TEXT,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  verification_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.professional_payment_accounts ADD CONSTRAINT professional_payment_accounts_tenant_id_professional_id_gat_key UNIQUE (tenant_id, professional_id, gateway_id);

ALTER TABLE public.professional_payment_accounts ADD CONSTRAINT professional_payment_accounts_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.professional_payment_accounts ADD CONSTRAINT professional_payment_accounts_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(user_id);

ALTER TABLE public.professional_payment_accounts ADD CONSTRAINT professional_payment_accounts_gateway_id_fkey
  FOREIGN KEY (gateway_id) REFERENCES public.tenant_payment_gateways(id);
