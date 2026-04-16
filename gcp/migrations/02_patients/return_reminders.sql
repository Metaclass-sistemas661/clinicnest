-- Table: return_reminders
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.return_reminders (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  medical_record_id UUID,
  appointment_id UUID,
  client_id UUID NOT NULL,
  professional_id UUID,
  service_id UUID,
  return_days INTEGER NOT NULL,
  return_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  scheduled_appointment_id UUID,
  notify_patient BOOLEAN DEFAULT true NOT NULL,
  notify_days_before INTEGER DEFAULT 3,
  last_notification_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0,
  preferred_contact TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_medical_record_id_fkey
  FOREIGN KEY (medical_record_id) REFERENCES public.medical_records(id);

ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.procedures(id);

ALTER TABLE public.return_reminders ADD CONSTRAINT return_reminders_scheduled_appointment_id_fkey
  FOREIGN KEY (scheduled_appointment_id) REFERENCES public.appointments(id);
