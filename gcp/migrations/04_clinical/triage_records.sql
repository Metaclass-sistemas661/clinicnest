-- Table: triage_records
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.triage_records (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  priority TEXT DEFAULT 'green' NOT NULL,
  chief_complaint TEXT,
  vital_signs JSONB,
  notes TEXT,
  classification TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  allergies TEXT,
  appointment_id UUID,
  blood_pressure_diastolic INTEGER,
  blood_pressure_systolic INTEGER,
  client_id UUID NOT NULL,
  current_medications TEXT,
  heart_rate INTEGER,
  height_cm INTEGER,
  medical_history TEXT,
  oxygen_saturation NUMERIC,
  pain_scale INTEGER,
  performed_by UUID,
  respiratory_rate INTEGER,
  status TEXT DEFAULT 'pendente' NOT NULL,
  temperature NUMERIC,
  triaged_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  weight_kg NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.triage_records ADD CONSTRAINT triage_records_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.triage_records ADD CONSTRAINT triage_records_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.triage_records ADD CONSTRAINT triage_records_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.triage_records ADD CONSTRAINT triage_records_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.triage_records ADD CONSTRAINT triage_records_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.triage_records ADD CONSTRAINT triage_records_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES public.profiles(id);

CREATE INDEX idx_triage_records_patient_id ON public.triage_records USING btree (patient_id);

CREATE INDEX idx_triage_records_tenant_id ON public.triage_records USING btree (tenant_id);
