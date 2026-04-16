-- Table: clinical_evolutions
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.clinical_evolutions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  appointment_id UUID,
  medical_record_id UUID,
  evolution_date DATE DEFAULT CURRENT_DATE NOT NULL,
  evolution_type TEXT DEFAULT 'medica' NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  cid_code TEXT,
  vital_signs JSONB DEFAULT '{}',
  digital_hash TEXT,
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signed_by_crm TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  server_timestamp TIMESTAMPTZ,
  signed_by_uf TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE public.clinical_evolutions ADD CONSTRAINT clinical_evolutions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.clinical_evolutions ADD CONSTRAINT clinical_evolutions_client_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.clinical_evolutions ADD CONSTRAINT clinical_evolutions_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.clinical_evolutions ADD CONSTRAINT clinical_evolutions_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);

ALTER TABLE public.clinical_evolutions ADD CONSTRAINT clinical_evolutions_medical_record_id_fkey
  FOREIGN KEY (medical_record_id) REFERENCES public.medical_records(id);
