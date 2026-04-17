CREATE OR REPLACE FUNCTION public.remove_certificate(p_certificate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_user_id UUID;

  v_profile_id UUID;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT id INTO v_profile_id

  FROM public.profiles

  WHERE user_id = v_user_id;



  UPDATE public.profile_certificates

  SET is_active = false, updated_at = NOW()

  WHERE id = p_certificate_id AND profile_id = v_profile_id;



  IF NOT FOUND THEN

    RETURN jsonb_build_object('success', false, 'error', 'Certificado n├úo encontrado');

  END IF;



  RETURN jsonb_build_object('success', true, 'message', 'Certificado removido');

END;

$function$;