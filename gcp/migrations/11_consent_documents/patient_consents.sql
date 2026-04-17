-- Table: patient_consents
-- Domain: 11_consent_documents
-- Stores each patient's signed consent/contract instance

CREATE TABLE IF NOT EXISTS public.patient_consents (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  template_id UUID,
  patient_user_id UUID,
  title TEXT NOT NULL DEFAULT '',
  content TEXT,
  status TEXT DEFAULT 'pending'::text,
  signed_at TIMESTAMPTZ,
  signature_method TEXT,
  signature_url TEXT,
  manual_signature_path TEXT,
  facial_photo_path TEXT,
  photo_url TEXT,
  sealed_pdf_path TEXT,
  sealed_pdf_url TEXT,
  sealed_pdf_hash TEXT,
  sealed_at TIMESTAMPTZ,
  template_snapshot_html TEXT,
  ip_address TEXT,
  user_agent TEXT,
  consent_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.patient_consents ADD CONSTRAINT patient_consents_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE public.patient_consents ADD CONSTRAINT patient_consents_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

CREATE INDEX IF NOT EXISTS idx_patient_consents_tenant ON public.patient_consents USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON public.patient_consents USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_template ON public.patient_consents USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_signed_at ON public.patient_consents USING btree (signed_at DESC NULLS LAST);

-- RLS
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_consents_tenant_isolation ON public.patient_consents
  USING (tenant_id = (NULLIF(current_setting('app.jwt_claims', true), '')::json->>'tenant_id')::uuid);

CREATE POLICY patient_consents_insert_policy ON public.patient_consents
  FOR INSERT WITH CHECK (
    tenant_id = (NULLIF(current_setting('app.jwt_claims', true), '')::json->>'tenant_id')::uuid
  );

CREATE POLICY patient_consents_update_policy ON public.patient_consents
  FOR UPDATE USING (
    tenant_id = (NULLIF(current_setting('app.jwt_claims', true), '')::json->>'tenant_id')::uuid
  );

CREATE POLICY patient_consents_delete_policy ON public.patient_consents
  FOR DELETE USING (
    tenant_id = (NULLIF(current_setting('app.jwt_claims', true), '')::json->>'tenant_id')::uuid
  );
