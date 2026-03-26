-- ============================================================================
-- FIX: digest() não encontrada em funções com SET search_path = public
--
-- Causa: Supabase instala pgcrypto no schema "extensions". Funções com
--        SET search_path = public não enxergam extensions.digest().
--
-- Solução:
--   1. Habilitar pgcrypto (idempotente)
--   2. Recriar validate_patient_access com search_path = public, extensions
-- ============================================================================

-- 1. Habilitar extensão pgcrypto no schema extensions (Supabase padrão)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Recriar validate_patient_access com search_path corrigido
CREATE OR REPLACE FUNCTION public.validate_patient_access(
  p_identifier TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  -- Hash do identificador para audit log (nunca armazena o CPF em texto plano)
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

  -- Tenta por access_code primeiro
  SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE upper(p.access_code) = v_identifier
  LIMIT 1;

  -- Se não encontrou, tenta por CPF (apenas dígitos)
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

  -- Registra tentativa no audit log
  INSERT INTO public.patient_access_attempts (identifier_hash, success)
  VALUES (v_id_hash, v_patient IS NOT NULL);

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Status da conta
  IF v_patient.user_id IS NOT NULL THEN
    v_status := 'has_account';
  ELSE
    v_status := 'new';
  END IF;

  -- Nome mascarado: "A. S." (apenas iniciais)
  v_masked_name := left(split_part(v_patient.name, ' ', 1), 1) || '.';
  IF split_part(v_patient.name, ' ', 2) <> '' THEN
    v_masked_name := v_masked_name || ' ' || left(split_part(v_patient.name, ' ', 2), 1) || '.';
  END IF;

  -- Email mascarado: "a****@g****.com" (1 char visível + asteriscos)
  IF v_patient.email IS NOT NULL AND v_patient.email <> '' THEN
    v_local_part  := split_part(v_patient.email, '@', 1);
    v_domain_part := split_part(v_patient.email, '@', 2);
    v_domain_name := split_part(v_domain_part, '.', 1);
    v_domain_ext  := substring(v_domain_part from position('.' in v_domain_part));

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
    'found',        true,
    'status',       v_status,
    'patient_id',   v_patient.id,
    'client_id',    v_patient.id,
    'masked_name',  v_masked_name,
    'clinic_name',  v_patient.clinic_name,
    'masked_email', v_masked_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO authenticated;
