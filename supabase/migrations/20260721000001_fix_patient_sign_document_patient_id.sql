-- ============================================================================
-- FIX: patient_sign_document RPC uses client_id but columns were renamed to patient_id
-- Error: column "client_id" does not exist (42703)
-- ============================================================================

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
  -- NOTE: client_id was renamed to patient_id by migration 20260330300000
  IF p_document_type = 'certificate' THEN
    PERFORM 1 FROM medical_certificates WHERE id = p_document_id AND patient_id = v_patient_id;
  ELSIF p_document_type = 'prescription' THEN
    PERFORM 1 FROM prescriptions WHERE id = p_document_id AND patient_id = v_patient_id;
  ELSIF p_document_type = 'exam' THEN
    PERFORM 1 FROM exam_results WHERE id = p_document_id AND patient_id = v_patient_id;
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
