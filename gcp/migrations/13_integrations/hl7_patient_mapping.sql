-- Table: hl7_patient_mapping
-- Domain: 13_integrations
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.hl7_patient_mapping (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  connection_id UUID,
  external_patient_id TEXT NOT NULL,
  external_system TEXT,
  client_id UUID NOT NULL,
  matched_by TEXT,
  confidence_score NUMERIC,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_tenant_id_external_patient_id_external__key UNIQUE (tenant_id, external_patient_id, external_system);

ALTER TABLE public.hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES public.hl7_connections(id);

ALTER TABLE public.hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.patients(id);

ALTER TABLE public.hl7_patient_mapping ADD CONSTRAINT hl7_patient_mapping_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES public.profiles(id);
