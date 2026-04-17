CREATE OR REPLACE FUNCTION public.set_default_certificate(p_certificate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

  v_profile_id UUID;

  v_cert_exists BOOLEAN;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT id INTO v_profile_id

  FROM public.profiles

  WHERE user_id = v_user_id;



  SELECT EXISTS(

    SELECT 1 FROM public.profile_certificates

    WHERE id = p_certificate_id AND profile_id = v_profile_id AND is_active = true

  ) INTO v_cert_exists;



  IF NOT v_cert_exists THEN

    RETURN jsonb_build_object('success', false, 'error', 'Certificado n├úo encontrado');

  END IF;



  UPDATE public.profile_certificates

  SET is_default = true

  WHERE id = p_certificate_id;



  RETURN jsonb_build_object('success', true, 'message', 'Certificado definido como padr├úo');

END;

$function$;