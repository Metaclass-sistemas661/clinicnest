-- Add p_cpf parameter to upsert_client_v2
-- Drop old signature first, then recreate with new parameter

DROP FUNCTION IF EXISTS public.upsert_client_v2(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.upsert_client_v2(
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_cpf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_access_code text;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome é obrigatório');
  END IF;

  IF p_client_id IS NULL THEN
    v_action := 'client_created';
    INSERT INTO public.clients(tenant_id, name, phone, email, notes, cpf)
    VALUES (v_profile.tenant_id, p_name, NULLIF(p_phone,''), NULLIF(p_email,''), NULLIF(p_notes,''), NULLIF(btrim(p_cpf),''))
    RETURNING id, access_code INTO v_id, v_access_code;
  ELSE
    v_action := 'client_updated';
    UPDATE public.clients
    SET name = p_name,
        phone = NULLIF(p_phone,''),
        email = NULLIF(p_email,''),
        notes = NULLIF(p_notes,''),
        cpf = NULLIF(btrim(p_cpf),''),
        updated_at = now()
    WHERE id = p_client_id
      AND tenant_id = v_profile.tenant_id
    RETURNING id, access_code INTO v_id, v_access_code;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Cliente não encontrado');
    END IF;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    v_action,
    'client',
    v_id::text,
    jsonb_build_object('name', p_name)
  );

  RETURN jsonb_build_object('success', true, 'client_id', v_id, 'access_code', v_access_code);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid, text) TO service_role;
