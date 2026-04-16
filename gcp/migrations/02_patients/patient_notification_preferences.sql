-- Table: patient_notification_preferences
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_notification_preferences (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  client_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  email_enabled BOOLEAN DEFAULT true NOT NULL,
  sms_enabled BOOLEAN DEFAULT true NOT NULL,
  whatsapp_enabled BOOLEAN DEFAULT true NOT NULL,
  push_enabled BOOLEAN DEFAULT true NOT NULL,
  opt_out_types TEXT[] DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_notification_preferences ADD CONSTRAINT patient_notification_preferences_client_id_tenant_id_key UNIQUE (client_id, tenant_id);

ALTER TABLE public.patient_notification_preferences ADD CONSTRAINT patient_notification_preferences_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.patient_notification_preferences ADD CONSTRAINT patient_notification_preferences_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
