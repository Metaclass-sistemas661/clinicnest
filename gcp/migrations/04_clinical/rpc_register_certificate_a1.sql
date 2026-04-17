CREATE OR REPLACE FUNCTION public.register_certificate_a1(p_common_name text, p_cpf_cnpj text, p_issuer text, p_serial_number text, p_not_before timestamp with time zone, p_not_after timestamp with time zone, p_thumbprint text, p_encrypted_pfx bytea, p_encryption_iv bytea, p_encryption_salt bytea, p_nickname text DEFAULT NULL::text, p_is_default boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

  v_profile_id UUID;

  v_tenant_id UUID;

  v_cert_id UUID;

  v_existing UUID;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT id, tenant_id INTO v_profile_id, v_tenant_id

  FROM public.profiles

  WHERE user_id = v_user_id;



  IF v_profile_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Perfil n├úo encontrado');

  END IF;



  -- Verificar se certificado j├í existe

  SELECT id INTO v_existing

  FROM public.profile_certificates

  WHERE profile_id = v_profile_id AND thumbprint = p_thumbprint;



  IF v_existing IS NOT NULL THEN

    -- Atualizar certificado existente

    UPDATE public.profile_certificates

    SET 

      encrypted_pfx = p_encrypted_pfx,

      encryption_iv = p_encryption_iv,

      encryption_salt = p_encryption_salt,

      nickname = COALESCE(p_nickname, nickname),

      is_default = p_is_default,

      is_active = true,

      updated_at = NOW()

    WHERE id = v_existing

    RETURNING id INTO v_cert_id;



    RETURN jsonb_build_object(

      'success', true,

      'certificate_id', v_cert_id,

      'message', 'Certificado atualizado com sucesso',

      'updated', true

    );

  END IF;



  -- Inserir novo certificado

  INSERT INTO public.profile_certificates (

    profile_id, tenant_id, certificate_type,

    common_name, cpf_cnpj, issuer, serial_number,

    not_before, not_after, thumbprint,

    encrypted_pfx, encryption_iv, encryption_salt,

    nickname, is_default

  ) VALUES (

    v_profile_id, v_tenant_id, 'A1',

    p_common_name, p_cpf_cnpj, p_issuer, p_serial_number,

    p_not_before, p_not_after, p_thumbprint,

    p_encrypted_pfx, p_encryption_iv, p_encryption_salt,

    p_nickname, p_is_default

  )

  RETURNING id INTO v_cert_id;



  RETURN jsonb_build_object(

    'success', true,

    'certificate_id', v_cert_id,

    'message', 'Certificado cadastrado com sucesso',

    'updated', false

  );

END;

$function$;