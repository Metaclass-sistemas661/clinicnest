CREATE OR REPLACE FUNCTION public.get_certificate_for_signing(p_certificate_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

  v_profile_id UUID;

  v_cert RECORD;

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



  -- Buscar certificado espec├¡fico ou padr├úo

  IF p_certificate_id IS NOT NULL THEN

    SELECT * INTO v_cert

    FROM public.profile_certificates

    WHERE id = p_certificate_id 

      AND profile_id = v_profile_id 

      AND is_active = true;

  ELSE

    SELECT * INTO v_cert

    FROM public.profile_certificates

    WHERE profile_id = v_profile_id 

      AND is_active = true 

      AND is_default = true;



    IF NOT FOUND THEN

      SELECT * INTO v_cert

      FROM public.profile_certificates

      WHERE profile_id = v_profile_id 

        AND is_active = true

      ORDER BY created_at DESC

      LIMIT 1;

    END IF;

  END IF;



  IF NOT FOUND THEN

    RETURN jsonb_build_object('success', false, 'error', 'Nenhum certificado encontrado');

  END IF;



  IF v_cert.not_after < NOW() THEN

    RETURN jsonb_build_object('success', false, 'error', 'Certificado expirado');

  END IF;



  -- Atualizar last_used_at

  UPDATE public.profile_certificates

  SET last_used_at = NOW()

  WHERE id = v_cert.id;



  RETURN jsonb_build_object(

    'success', true,

    'certificate', jsonb_build_object(

      'id', v_cert.id,

      'certificate_type', v_cert.certificate_type,

      'common_name', v_cert.common_name,

      'cpf_cnpj', v_cert.cpf_cnpj,

      'issuer', v_cert.issuer,

      'thumbprint', v_cert.thumbprint,

      'encrypted_pfx', encode(v_cert.encrypted_pfx, 'base64'),

      'encryption_iv', encode(v_cert.encryption_iv, 'base64'),

      'encryption_salt', encode(v_cert.encryption_salt, 'base64')

    )

  );

END;

$function$;