-- Table: appointments
-- Domain: 03_appointments
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID,
  procedure_id UUID,
  professional_id UUID,
  specialty_id UUID,
  insurance_plan_id UUID,
  room_id UUID,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30 NOT NULL,
  status APPOINTMENT_STATUS DEFAULT 'pending' NOT NULL,
  price NUMERIC DEFAULT 0 NOT NULL,
  commission_amount NUMERIC,
  consultation_type TEXT,
  insurance_authorization TEXT,
  cid_code TEXT,
  notes TEXT,
  telemedicine BOOLEAN DEFAULT false,
  telemedicine_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  booked_by_id UUID,
  client_id UUID,
  confirmation_sent_4h BOOLEAN DEFAULT false NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_via TEXT DEFAULT 'internal' NOT NULL,
  service_id UUID,
  source TEXT,
  telemedicine_token UUID,
  unit_id UUID,
  PRIMARY KEY (id)
);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_telemedicine_token_key UNIQUE (telemedicine_token);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_procedure_id_fkey
  FOREIGN KEY (procedure_id) REFERENCES public.procedures(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_specialty_id_fkey
  FOREIGN KEY (specialty_id) REFERENCES public.specialties(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_insurance_plan_id_fkey
  FOREIGN KEY (insurance_plan_id) REFERENCES public.insurance_plans(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES public.rooms(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_booked_by_id_fkey
  FOREIGN KEY (booked_by_id) REFERENCES public.profiles(user_id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.procedures(id);

ALTER TABLE public.appointments ADD CONSTRAINT appointments_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.clinic_units(id);

CREATE INDEX idx_appointments_created_via ON public.appointments USING btree (created_via);

CREATE INDEX idx_appointments_patient_id ON public.appointments USING btree (patient_id);

CREATE INDEX idx_appointments_professional_id ON public.appointments USING btree (professional_id);

CREATE INDEX idx_appointments_scheduled_at ON public.appointments USING btree (scheduled_at);

CREATE INDEX idx_appointments_source ON public.appointments USING btree (tenant_id, source) WHERE (source = 'online'::text);

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);

CREATE INDEX idx_appointments_tenant_id ON public.appointments USING btree (tenant_id);

CREATE INDEX idx_appointments_tenant_professional_scheduled_at ON public.appointments USING btree (tenant_id, professional_id, scheduled_at);

CREATE INDEX idx_appointments_tenant_professional_scheduled_at_not_cancelled ON public.appointments USING btree (tenant_id, professional_id, scheduled_at) WHERE (status <> 'cancelled'::appointment_status);

CREATE INDEX idx_appointments_tenant_scheduled_at ON public.appointments USING btree (tenant_id, scheduled_at);
