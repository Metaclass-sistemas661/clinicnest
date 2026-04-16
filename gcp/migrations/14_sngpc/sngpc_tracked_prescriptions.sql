-- Table: sngpc_tracked_prescriptions
-- Domain: 14_sngpc
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.sngpc_tracked_prescriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  prescription_id UUID,
  patient_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  anvisa_lista TEXT NOT NULL,
  recipe_type TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  medication_dosage TEXT,
  medication_quantity TEXT,
  medication_duration_days INTEGER,
  dispensed_at TIMESTAMPTZ,
  dispensed_by TEXT,
  dispensed_pharmacy TEXT,
  dispensation_status TEXT DEFAULT 'pendente' NOT NULL,
  sngpc_notified BOOLEAN DEFAULT false,
  sngpc_notification_date TIMESTAMPTZ,
  sngpc_protocol TEXT,
  prescribed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_prescription_id_fkey
  FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);

ALTER TABLE public.sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE public.sngpc_tracked_prescriptions ADD CONSTRAINT sngpc_tracked_prescriptions_professional_id_fkey
  FOREIGN KEY (professional_id) REFERENCES public.profiles(id);
