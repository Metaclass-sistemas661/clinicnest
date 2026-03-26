-- ============================================================================
-- SECURITY: Melhorar mascaramento de dados na identificação
--
-- Problemas:
--   1. Nome: "André S." — expõe primeiro nome completo
--   2. Email: "an***@gm***.com" — mostra 2 chars (pode ser dedutível)
--
-- Solução:
--   - Nome: apenas "A. S." (iniciais) para nomes compostos, "A." para nome simples
--   - Email: "a****@g****.com" (apenas 1 char visível em cada parte)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_patient_access(
  p_identifier TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_identifier TEXT := btrim(upper(p_identifier));
  v_cpf_clean TEXT;
  v_status TEXT;
  v_masked_name TEXT;
  v_masked_email TEXT;
  v_id_hash TEXT;
  v_recent_attempts INT;
  v_local_part TEXT;
  v_domain_part TEXT;
  v_domain_name TEXT;
  v_domain_ext TEXT;
BEGIN
  -- Delay artificial para dificultar brute-force
  PERFORM pg_sleep(0.2);

  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Hash do identificador para audit log
  v_id_hash := encode(digest(v_identifier, 'sha256'), 'hex');

  -- Rate limiting: máximo 5 tentativas por identificador nos últimos 2 minutos
  SELECT count(*) INTO v_recent_attempts
  FROM public.patient_access_attempts
  WHERE identifier_hash = v_id_hash
    AND created_at > now() - interval '2 minutes';

  IF v_recent_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'found', false,
      'error', 'Muitas tentativas. Aguarde alguns minutos.'
    );
  END IF;

  -- Try by access_code first
  SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE upper(p.access_code) = v_identifier
  LIMIT 1;

  -- If not found, try by CPF (digits only)
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

  -- Log da tentativa
  INSERT INTO public.patient_access_attempts (identifier_hash, success)
  VALUES (v_id_hash, v_patient IS NOT NULL);

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Determine status
  IF v_patient.user_id IS NOT NULL THEN
    v_status := 'has_account';
  ELSE
    v_status := 'new';
  END IF;

  -- Masked name: "A. S." (apenas iniciais)
  v_masked_name := left(split_part(v_patient.name, ' ', 1), 1) || '.';
  IF split_part(v_patient.name, ' ', 2) <> '' THEN
    v_masked_name := v_masked_name || ' ' || left(split_part(v_patient.name, ' ', 2), 1) || '.';
  END IF;

  -- Masked email: "a****@g****.com" (1 char visível + asteriscos)
  IF v_patient.email IS NOT NULL AND v_patient.email <> '' THEN
    v_local_part := split_part(v_patient.email, '@', 1);
    v_domain_part := split_part(v_patient.email, '@', 2);
    v_domain_name := split_part(v_domain_part, '.', 1);
    v_domain_ext := substring(v_domain_part from position('.' in v_domain_part));

    v_masked_email := left(v_local_part, 1)
      || repeat('*', GREATEST(length(v_local_part) - 1, 3))
      || '@'
      || left(v_domain_name, 1)
      || repeat('*', GREATEST(length(v_domain_name) - 1, 3))
      || v_domain_ext;
  ELSE
    v_masked_email := NULL;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_status,
    'patient_id', v_patient.id,
    'client_id', v_patient.id,
    'masked_name', v_masked_name,
    'clinic_name', v_patient.clinic_name,
    'masked_email', v_masked_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO authenticated;
