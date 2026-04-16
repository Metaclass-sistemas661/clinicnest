-- Table: tenants
-- Domain: 01_foundation
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  nfeio_active BOOLEAN DEFAULT false,
  nfeio_api_key TEXT,
  nfeio_auto_emit BOOLEAN DEFAULT false,
  nfeio_certificate_expires TIMESTAMPTZ,
  nfeio_company_id TEXT,
  nfeio_default_service_code TEXT DEFAULT '4.03',
  billing_cpf_cnpj TEXT,
  cashback_enabled BOOLEAN DEFAULT false NOT NULL,
  default_commission_percent NUMERIC DEFAULT 10,
  email_reply_to TEXT,
  gamification_enabled BOOLEAN DEFAULT true,
  online_booking_enabled BOOLEAN DEFAULT false NOT NULL,
  patient_booking_enabled BOOLEAN DEFAULT false NOT NULL,
  patient_payment_enabled BOOLEAN DEFAULT false NOT NULL,
  points_enabled BOOLEAN DEFAULT false,
  retention_years INTEGER DEFAULT 20 NOT NULL,
  rnds_enabled BOOLEAN DEFAULT false,
  show_clinic_average_to_staff BOOLEAN DEFAULT false NOT NULL,
  smart_confirmation_enabled BOOLEAN DEFAULT false NOT NULL,
  sms_provider TEXT DEFAULT 'zenvia',
  stone_api_key TEXT,
  autonomous_config JSONB DEFAULT '{}',
  PRIMARY KEY (id)
);

CREATE INDEX idx_tenants_billing_cpf_cnpj ON public.tenants USING btree (billing_cpf_cnpj);

CREATE INDEX idx_tenants_email ON public.tenants USING btree (email);
