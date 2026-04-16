-- Table: medical_records
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.medical_records (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  appointment_id UUID,
  record_type TEXT DEFAULT 'soap',
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  notes TEXT,
  cid_codes TEXT[],
  vital_signs JSONB,
  attachments JSONB,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  attendance_number BIGINT,
  attendance_type ATTENDANCE_TYPE DEFAULT 'consulta',
  server_timestamp TIMESTAMPTZ,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

CREATE INDEX idx_medical_records_appointment_id ON public.medical_records USING btree (appointment_id);

CREATE INDEX idx_medical_records_patient_id ON public.medical_records USING btree (patient_id);

CREATE INDEX idx_medical_records_professional_id ON public.medical_records USING btree (professional_id);

CREATE INDEX idx_medical_records_tenant_id ON public.medical_records USING btree (tenant_id);
