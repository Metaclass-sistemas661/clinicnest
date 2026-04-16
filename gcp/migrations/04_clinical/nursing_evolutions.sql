-- Table: nursing_evolutions
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.nursing_evolutions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  professional_id UUID,
  evolution_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  nanda_code TEXT,
  nanda_diagnosis TEXT NOT NULL,
  nic_code TEXT,
  nic_intervention TEXT,
  nic_activities TEXT,
  noc_code TEXT,
  noc_outcome TEXT,
  noc_score_initial INTEGER,
  noc_score_current INTEGER,
  noc_score_target INTEGER,
  notes TEXT,
  vital_signs JSONB,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.nursing_evolutions ADD CONSTRAINT nursing_evolutions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.nursing_evolutions ADD CONSTRAINT nursing_evolutions_client_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.nursing_evolutions ADD CONSTRAINT nursing_evolutions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.nursing_evolutions ADD CONSTRAINT nursing_evolutions_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);
