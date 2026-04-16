-- Table: appointment_package_consumptions
-- Domain: 03_appointments
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.appointment_package_consumptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  package_id UUID NOT NULL,
  sessions_used INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  consumed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.appointment_package_consumptions ADD CONSTRAINT appointment_package_consumptions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.appointment_package_consumptions ADD CONSTRAINT appointment_package_consumptions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.appointment_package_consumptions ADD CONSTRAINT appointment_package_consumptions_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.client_packages(id);
