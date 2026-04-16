-- Table: medical_reports
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.medical_reports (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  medical_record_id UUID,
  appointment_id UUID,
  tipo TEXT DEFAULT 'medico' NOT NULL,
  finalidade TEXT,
  historia_clinica TEXT,
  exame_fisico TEXT,
  exames_complementares TEXT,
  diagnostico TEXT,
  cid10 TEXT,
  conclusao TEXT NOT NULL,
  observacoes TEXT,
  status TEXT DEFAULT 'rascunho' NOT NULL,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.medical_reports ADD CONSTRAINT medical_reports_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.medical_reports ADD CONSTRAINT medical_reports_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.medical_reports ADD CONSTRAINT medical_reports_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.medical_reports ADD CONSTRAINT medical_reports_medical_record_id_fkey
  FOREIGN KEY (medical_record_id) REFERENCES public.medical_records(id);

ALTER TABLE public.medical_reports ADD CONSTRAINT medical_reports_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);
