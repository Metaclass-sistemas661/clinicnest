-- Table: dental_prescriptions
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.dental_prescriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  periogram_id UUID,
  odontogram_id UUID,
  prescription_date DATE DEFAULT CURRENT_DATE NOT NULL,
  diagnosis TEXT,
  medications JSONB DEFAULT '[]' NOT NULL,
  instructions TEXT,
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signed_by_cro TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.dental_prescriptions ADD CONSTRAINT dental_prescriptions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.dental_prescriptions ADD CONSTRAINT dental_prescriptions_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.dental_prescriptions ADD CONSTRAINT dental_prescriptions_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);

ALTER TABLE public.dental_prescriptions ADD CONSTRAINT dental_prescriptions_periogram_id_fkey
  FOREIGN KEY (periogram_id) REFERENCES public.periograms(id);

ALTER TABLE public.dental_prescriptions ADD CONSTRAINT dental_prescriptions_odontogram_id_fkey
  FOREIGN KEY (odontogram_id) REFERENCES public.odontograms(id);
