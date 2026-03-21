-- ============================================================================
-- Migration: Document Signatures + Patient signing RPCs
-- Adds:
--   1. document_signatures table (stores patient signatures on clinical docs)
--   2. patient_sign_document RPC (SECURITY DEFINER — patient signs a document)
--   3. get_patient_document_signatures RPC (returns signed docs for patient)
--   4. Storage bucket "document-signatures" for signature images
-- ============================================================================

-- ─── 1. Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_signatures (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('certificate','prescription','exam','report')),
  document_id uuid NOT NULL,
  signature_method text NOT NULL CHECK (signature_method IN ('facial','manual')),
  signature_path   text,          -- storage path for manual signature image
  facial_photo_path text,         -- storage path for facial photo
  ip_address  text,
  user_agent  text,
  signed_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (patient_id, document_type, document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_patient ON public.document_signatures(patient_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_tenant  ON public.document_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_doc     ON public.document_signatures(document_type, document_id);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- Patients can read their own signatures
CREATE POLICY "document_signatures_select_own"
  ON public.document_signatures FOR SELECT
  USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- Staff can read signatures for their tenant
CREATE POLICY "document_signatures_select_tenant"
  ON public.document_signatures FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- ─── 2. RPC: patient_sign_document ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.patient_sign_document(
  p_document_type text,
  p_document_id uuid,
  p_signature_method text,
  p_signature_path text DEFAULT NULL,
  p_facial_photo_path text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_patient_id uuid;
  v_tenant_id uuid;
  v_existing uuid;
BEGIN
  -- Resolve patient profile
  SELECT pp.client_id INTO v_patient_id
  FROM patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Perfil de paciente não encontrado');
  END IF;

  -- Resolve tenant from patients table
  SELECT p.tenant_id INTO v_tenant_id
  FROM patients p
  WHERE p.id = v_patient_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Clínica não encontrada');
  END IF;

  -- Check if already signed
  SELECT id INTO v_existing
  FROM document_signatures
  WHERE patient_id = v_patient_id
    AND document_type = p_document_type
    AND document_id = p_document_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este documento já foi assinado');
  END IF;

  -- Validate document exists and belongs to this patient
  IF p_document_type = 'certificate' THEN
    PERFORM 1 FROM medical_certificates WHERE id = p_document_id AND client_id = v_patient_id;
  ELSIF p_document_type = 'prescription' THEN
    PERFORM 1 FROM prescriptions WHERE id = p_document_id AND client_id = v_patient_id;
  ELSIF p_document_type = 'exam' THEN
    PERFORM 1 FROM exam_results WHERE id = p_document_id AND client_id = v_patient_id;
  ELSIF p_document_type = 'report' THEN
    PERFORM 1 FROM medical_reports WHERE id = p_document_id AND patient_id = v_patient_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Tipo de documento inválido');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Documento não encontrado ou sem permissão');
  END IF;

  -- Insert signature
  INSERT INTO document_signatures (
    tenant_id, patient_id, document_type, document_id,
    signature_method, signature_path, facial_photo_path,
    ip_address, user_agent
  ) VALUES (
    v_tenant_id, v_patient_id, p_document_type, p_document_id,
    p_signature_method, p_signature_path, p_facial_photo_path,
    NULL, p_user_agent
  );

  RETURN jsonb_build_object('success', true, 'message', 'Documento assinado com sucesso!');
END;
$$;

-- ─── 3. RPC: get_patient_document_signatures ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_patient_document_signatures()
RETURNS TABLE (
  id uuid,
  document_type text,
  document_id uuid,
  signature_method text,
  signed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  SELECT pp.client_id INTO v_patient_id
  FROM patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ds.id, ds.document_type, ds.document_id, ds.signature_method, ds.signed_at
  FROM document_signatures ds
  WHERE ds.patient_id = v_patient_id
  ORDER BY ds.signed_at DESC;
END;
$$;

-- ─── 4. Storage bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-signatures',
  'document-signatures',
  false,
  5242880,  -- 5MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: patients can upload their own, staff can read tenant's
CREATE POLICY "document_signatures_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'document-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT pp.client_id::text FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

CREATE POLICY "document_signatures_read_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'document-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT pp.client_id::text FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );
