-- Table: patient_calls
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_calls (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  triage_id UUID,
  room_id UUID,
  room_name TEXT,
  professional_id UUID,
  professional_name TEXT,
  status TEXT DEFAULT 'waiting' NOT NULL,
  priority INTEGER DEFAULT 5,
  priority_label TEXT,
  call_number INTEGER,
  times_called INTEGER DEFAULT 0,
  first_called_at TIMESTAMPTZ,
  last_called_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  started_service_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_calls ADD CONSTRAINT patient_calls_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_calls ADD CONSTRAINT patient_calls_client_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.patient_calls ADD CONSTRAINT patient_calls_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.patient_calls ADD CONSTRAINT patient_calls_triage_id_fkey
  FOREIGN KEY (triage_id) REFERENCES public.triage_records(id);

ALTER TABLE public.patient_calls ADD CONSTRAINT patient_calls_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES public.rooms(id);

ALTER TABLE public.patient_calls ADD CONSTRAINT patient_calls_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);
