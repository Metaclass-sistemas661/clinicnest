-- Table: medical_record_versions
-- Domain: 04_clinical
-- Generated from Cloud SQL on 2026-04-16

CREATE TABLE IF NOT EXISTS public.medical_record_versions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  record_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  version_number INTEGER DEFAULT 1 NOT NULL,
  content JSONB NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.medical_record_versions ADD CONSTRAINT medical_record_versions_record_id_fkey
  FOREIGN KEY (record_id) REFERENCES public.medical_records(id);

ALTER TABLE public.medical_record_versions ADD CONSTRAINT medical_record_versions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

CREATE INDEX idx_medical_record_versions_record ON public.medical_record_versions USING btree (record_id);
