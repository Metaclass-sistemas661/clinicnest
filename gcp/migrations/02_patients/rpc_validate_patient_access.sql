-- RPC: validate_patient_access
-- Validates a patient access code or CPF and returns patient info + status
-- Called by: PatientLogin.tsx (patient portal authentication step 1)

CREATE OR REPLACE FUNCTION public.validate_patient_access(p_identifier text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_patient RECORD;
  v_identifier TEXT := btrim(upper(p_identifier));
  v_cpf_clean TEXT;
  v_status TEXT;
BEGIN
  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Identificador não informado');
  END IF;

  -- Try matching by access_code first
  SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE upper(p.access_code) = v_identifier
  LIMIT 1;

  -- If not found by access_code, try CPF
  IF v_patient IS NULL THEN
    v_cpf_clean := regexp_replace(p_identifier, '[^0-9]', '', 'g');
    IF length(v_cpf_clean) >= 11 THEN
      SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
             t.name AS clinic_name
      INTO v_patient
      FROM public.patients p
      LEFT JOIN public.tenants t ON t.id = p.tenant_id
      WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = v_cpf_clean
      LIMIT 1;
    END IF;
  END IF;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_patient.user_id IS NOT NULL THEN v_status := 'has_account';
  ELSE v_status := 'new';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_status,
    'patient_id', v_patient.id,
    'client_id', v_patient.id,
    'client_name', v_patient.name,
    'client_email', v_patient.email,
    'clinic_name', v_patient.clinic_name,
    'masked_email', CASE
      WHEN v_patient.email IS NOT NULL AND v_patient.email <> '' THEN
        substr(v_patient.email, 1, 2) || '***@' || split_part(v_patient.email, '@', 2)
      ELSE NULL
    END
  );
END;
$function$;
