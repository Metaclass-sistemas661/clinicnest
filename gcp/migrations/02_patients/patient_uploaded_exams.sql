-- Table: patient_uploaded_exams
-- Domain: 02_patients
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.patient_uploaded_exams (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0 NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream' NOT NULL,
  exam_name TEXT DEFAULT '' NOT NULL,
  exam_date DATE,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pendente' NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_uploaded_exams ADD CONSTRAINT patient_uploaded_exams_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_uploaded_exams ADD CONSTRAINT patient_uploaded_exams_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);
