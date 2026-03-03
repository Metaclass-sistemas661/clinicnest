-- ============================================================================
-- APLICAR NO SUPABASE SQL EDITOR
-- Migration 900000: RPCs para perfil do paciente no Portal do Paciente
-- ============================================================================
-- Resolvem os 3 problemas:
--   1) Dados do paciente não apareciam na aba "Meu Perfil"
--   2) Botão "Editar contato" não funcionava (update bloqueado por RLS)
--   3) Agora usa SECURITY DEFINER (consistente com o resto do portal)
-- ============================================================================

-- ─── 1) RPC: get_patient_profile ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_patient_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_link   record;
  v_pat    record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT client_id, tenant_id INTO v_link
  FROM public.patient_profiles
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_link IS NULL THEN
    RETURN jsonb_build_object('error', 'NO_LINK');
  END IF;

  SELECT
    p.id,
    p.name,
    p.email,
    p.phone,
    p.cpf,
    p.date_of_birth,
    p.marital_status,
    p.zip_code,
    p.street,
    p.street_number,
    p.complement,
    p.neighborhood,
    p.city,
    p.state,
    p.allergies
  INTO v_pat
  FROM public.patients p
  WHERE p.id = v_link.client_id;

  IF v_pat IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  RETURN jsonb_build_object(
    'id',              v_pat.id,
    'name',            COALESCE(v_pat.name, ''),
    'email',           v_pat.email,
    'phone',           v_pat.phone,
    'cpf',             v_pat.cpf,
    'date_of_birth',   v_pat.date_of_birth,
    'marital_status',  v_pat.marital_status,
    'zip_code',        v_pat.zip_code,
    'street',          v_pat.street,
    'street_number',   v_pat.street_number,
    'complement',      v_pat.complement,
    'neighborhood',    v_pat.neighborhood,
    'city',            v_pat.city,
    'state',           v_pat.state,
    'allergies',       v_pat.allergies
  );
END;
$$;

-- ─── 2) RPC: update_patient_contact ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_patient_contact(
  p_phone         text DEFAULT NULL,
  p_email         text DEFAULT NULL,
  p_zip_code      text DEFAULT NULL,
  p_street        text DEFAULT NULL,
  p_street_number text DEFAULT NULL,
  p_complement    text DEFAULT NULL,
  p_neighborhood  text DEFAULT NULL,
  p_city          text DEFAULT NULL,
  p_state         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_link      record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT client_id, tenant_id INTO v_link
  FROM public.patient_profiles
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_link IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_LINK');
  END IF;

  UPDATE public.patients SET
    phone          = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
    email          = COALESCE(NULLIF(TRIM(p_email), ''), email),
    zip_code       = COALESCE(NULLIF(TRIM(p_zip_code), ''), zip_code),
    street         = COALESCE(NULLIF(TRIM(p_street), ''), street),
    street_number  = COALESCE(NULLIF(TRIM(p_street_number), ''), street_number),
    complement     = CASE WHEN p_complement IS NOT NULL THEN NULLIF(TRIM(p_complement), '') ELSE complement END,
    neighborhood   = COALESCE(NULLIF(TRIM(p_neighborhood), ''), neighborhood),
    city           = COALESCE(NULLIF(TRIM(p_city), ''), city),
    state          = COALESCE(NULLIF(TRIM(p_state), ''), state),
    updated_at     = now()
  WHERE id = v_link.client_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── 3) Grants ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_patient_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_patient_contact(text,text,text,text,text,text,text,text,text) TO authenticated;
