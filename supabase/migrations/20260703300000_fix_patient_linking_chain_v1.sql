-- ============================================================================
-- FIX: Corrigir cadeia de vinculação do portal do paciente
-- 
-- Problema: Paciente logado aparece "Cadastro ainda não vinculado" porque
-- a row em patient_profiles nunca é criada. Três bugs na cadeia:
--
-- BUG 1: validate_patient_access() retorna chave 'client_id' no JSON,
--         mas o frontend lê 'patient_id' → undefined.
-- BUG 2: activate_patient_account() referencia 'public.clients' (view OK
--         mas melhor usar 'patients' diretamente).
-- BUG 3: Não existe mecanismo de auto-link para pacientes que já têm
--         auth user mas não têm patient_profiles (e.g. criados antes do fix).
--
-- Solução:
-- 1. validate_patient_access → retornar 'patient_id' no JSON
-- 2. activate_patient_account → usar 'patients' diretamente
-- 3. Nova RPC auto_link_patient → chamada após login se não vinculado
-- 4. Backfill patient_profiles para pacientes com user_id sem perfil
-- ============================================================================

-- ============================================================================
-- 1. FIX validate_patient_access — retornar patient_id em vez de client_id
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
BEGIN
  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Identificador não informado');
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

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Determine status
  IF v_patient.user_id IS NOT NULL THEN
    v_status := 'has_account';
  ELSE
    v_status := 'new';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_status,
    'patient_id', v_patient.id,          -- ← CORRIGIDO: era 'client_id'
    'client_id', v_patient.id,           -- ← mantém compat com código legado
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
$$;

-- Manter grants existentes
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO authenticated;

-- ============================================================================
-- 2. FIX activate_patient_account — usar 'patients' diretamente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.activate_patient_account(
  p_client_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_pp_id UUID;
BEGIN
  -- Validate patient exists and has no user_id yet
  SELECT id, tenant_id, name, user_id
  INTO v_patient
  FROM public.patients
  WHERE id = p_client_id;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLIENT_NOT_FOUND');
  END IF;

  IF v_patient.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ACTIVATED');
  END IF;

  -- Link user to patient record
  UPDATE public.patients
  SET user_id = p_user_id, updated_at = now()
  WHERE id = p_client_id;

  -- Create patient_profiles entry (upsert to avoid conflicts)
  INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
  VALUES (p_user_id, v_patient.tenant_id, p_client_id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, is_active = true, updated_at = now()
  RETURNING id INTO v_pp_id;

  RETURN jsonb_build_object(
    'success', true,
    'patient_profile_id', v_pp_id,
    'client_name', v_patient.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_patient_account(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.activate_patient_account(UUID, UUID) TO service_role;

-- ============================================================================
-- 3. NOVA RPC: auto_link_patient — auto-vincula paciente após login
--    Chamada pelo frontend quando dashboard retorna is_linked=false.
--    Busca na tabela patients por user_id ou email para criar patient_profiles.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_link_patient()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_patient RECORD;
  v_pp_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  -- Check if already linked
  IF EXISTS (
    SELECT 1 FROM public.patient_profiles
    WHERE user_id = v_user_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('linked', true, 'reason', 'ALREADY_LINKED');
  END IF;

  -- Strategy 1: Find patient by user_id column (set during activation)
  SELECT id, tenant_id, name
  INTO v_patient
  FROM public.patients
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Strategy 2: Find patient by email
  IF v_patient IS NULL THEN
    SELECT email INTO v_user_email
    FROM auth.users WHERE id = v_user_id;

    IF v_user_email IS NOT NULL AND v_user_email <> '' THEN
      SELECT id, tenant_id, name
      INTO v_patient
      FROM public.patients
      WHERE lower(email) = lower(v_user_email)
      LIMIT 1;

      -- Also set user_id on the patient record for future lookups
      IF v_patient IS NOT NULL THEN
        UPDATE public.patients
        SET user_id = v_user_id, updated_at = now()
        WHERE id = v_patient.id AND user_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'PATIENT_NOT_FOUND');
  END IF;

  -- Create patient_profiles link
  INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
  VALUES (v_user_id, v_patient.tenant_id, v_patient.id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, is_active = true, updated_at = now()
  RETURNING id INTO v_pp_id;

  RETURN jsonb_build_object(
    'linked', true,
    'reason', 'AUTO_LINKED',
    'patient_profile_id', v_pp_id,
    'patient_name', v_patient.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_link_patient() TO authenticated;

-- ============================================================================
-- 4. Backfill: criar patient_profiles para pacientes que têm user_id
--    setado na tabela patients mas não possuem row em patient_profiles
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT p.id AS patient_id, p.user_id, p.tenant_id
    FROM public.patients p
    WHERE p.user_id IS NOT NULL
      AND p.tenant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.patient_profiles pp
        WHERE pp.user_id = p.user_id
          AND pp.tenant_id = p.tenant_id
      )
  LOOP
    INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
    VALUES (r.user_id, r.tenant_id, r.patient_id)
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill: % patient_profiles rows created', v_count;
END;
$$;
