CREATE OR REPLACE FUNCTION public.list_my_certificates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

  v_profile_id UUID;

  v_certs JSONB;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT id INTO v_profile_id

  FROM public.profiles

  WHERE user_id = v_user_id;



  IF v_profile_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Perfil n├úo encontrado');

  END IF;



  SELECT COALESCE(jsonb_agg(

    jsonb_build_object(

      'id', c.id,

      'certificate_type', c.certificate_type,

      'common_name', c.common_name,

      'cpf_cnpj', c.cpf_cnpj,

      'issuer', c.issuer,

      'serial_number', c.serial_number,

      'not_before', c.not_before,

      'not_after', c.not_after,

      'thumbprint', c.thumbprint,

      'is_active', c.is_active,

      'is_default', c.is_default,

      'nickname', c.nickname,

      'created_at', c.created_at,

      'last_used_at', c.last_used_at,

      'days_until_expiry', EXTRACT(DAY FROM (c.not_after - NOW())),

      'is_expired', c.not_after < NOW(),

      'has_encrypted_pfx', c.encrypted_pfx IS NOT NULL

    ) ORDER BY c.is_default DESC, c.created_at DESC

  ), '[]'::jsonb) INTO v_certs

  FROM public.profile_certificates c

  WHERE c.profile_id = v_profile_id AND c.is_active = true;



  RETURN jsonb_build_object('success', true, 'certificates', v_certs);

END;

$function$;