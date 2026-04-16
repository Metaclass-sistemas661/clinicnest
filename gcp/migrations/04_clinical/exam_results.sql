-- Table: exam_results
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID,
  exam_type TEXT NOT NULL,
  exam_date DATE,
  results JSONB,
  file_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  exam_category TEXT,
  performed_by UUID,
  result_data JSONB,
  PRIMARY KEY (id)
);

ALTER TABLE public.exam_results ADD CONSTRAINT exam_results_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.exam_results ADD CONSTRAINT exam_results_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.exam_results ADD CONSTRAINT exam_results_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.exam_results ADD CONSTRAINT exam_results_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES public.profiles(id);

CREATE INDEX idx_exam_results_patient_id ON public.exam_results USING btree (patient_id);

CREATE INDEX idx_exam_results_tenant_id ON public.exam_results USING btree (tenant_id);
