-- Table: waitlist_notifications
-- Domain: 03_appointments
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.waitlist_notifications (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  waitlist_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_date TIMESTAMPTZ NOT NULL,
  service_id UUID,
  professional_id UUID,
  period TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.waitlist_notifications ADD CONSTRAINT waitlist_notifications_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.waitlist_notifications ADD CONSTRAINT waitlist_notifications_waitlist_id_fkey
  FOREIGN KEY (waitlist_id) REFERENCES public.waitlist(id);
