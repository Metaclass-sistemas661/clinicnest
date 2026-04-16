-- Table: waitlist
-- Domain: 03_appointments
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  procedure_id UUID,
  professional_id UUID,
  preferred_dates TEXT,
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  status TEXT DEFAULT 'waiting',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  client_id UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  preferred_periods TEXT[],
  reason TEXT,
  scheduled_at TIMESTAMPTZ,
  service_id UUID,
  specialty_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_procedure_id_fkey
  FOREIGN KEY (procedure_id) REFERENCES public.procedures(id);

ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.procedures(id);

ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_specialty_id_fkey
  FOREIGN KEY (specialty_id) REFERENCES public.specialties(id);

CREATE INDEX idx_waitlist_tenant_id ON public.waitlist USING btree (tenant_id);
