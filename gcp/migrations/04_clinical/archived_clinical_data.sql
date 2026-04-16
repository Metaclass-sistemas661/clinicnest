-- Table: archived_clinical_data
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.archived_clinical_data (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_cpf TEXT,
  client_cns TEXT,
  client_birth_date DATE,
  medical_records JSONB DEFAULT '[]' NOT NULL,
  prescriptions JSONB DEFAULT '[]' NOT NULL,
  triages JSONB DEFAULT '[]' NOT NULL,
  evolutions JSONB DEFAULT '[]' NOT NULL,
  attachments JSONB DEFAULT '[]' NOT NULL,
  last_appointment_date DATE NOT NULL,
  retention_expired_at DATE NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  archived_by UUID,
  export_pdf_url TEXT,
  export_xml_url TEXT,
  export_generated_at TIMESTAMPTZ,
  data_hash TEXT NOT NULL,
  can_be_deleted_after DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.archived_clinical_data ADD CONSTRAINT archived_clinical_data_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
