-- Table: client_marketing_preferences
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.client_marketing_preferences (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  email_opt_in BOOLEAN DEFAULT true,
  sms_opt_in BOOLEAN DEFAULT true,
  whatsapp_opt_in BOOLEAN DEFAULT true,
  push_opt_in BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.client_marketing_preferences ADD CONSTRAINT client_marketing_preferences_patient_id_key UNIQUE (patient_id);

ALTER TABLE public.client_marketing_preferences ADD CONSTRAINT client_marketing_preferences_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.client_marketing_preferences ADD CONSTRAINT client_marketing_preferences_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX idx_client_marketing_prefs_patient ON public.client_marketing_preferences USING btree (patient_id);
