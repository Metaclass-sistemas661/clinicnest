CREATE OR REPLACE FUNCTION public.generate_telemedicine_token(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_caller_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_apt record;

  v_token uuid;

BEGIN

  -- Validate caller is staff

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_caller_id LIMIT 1;

  IF v_profile IS NULL THEN

    RAISE EXCEPTION 'NOT_STAFF';

  END IF;



  -- Validate appointment belongs to caller's tenant and is telemedicine

  SELECT id, tenant_id, telemedicine, telemedicine_token

    INTO v_apt

    FROM public.appointments

    WHERE id = p_appointment_id AND tenant_id = v_profile.tenant_id;



  IF v_apt IS NULL THEN

    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';

  END IF;



  IF v_apt.telemedicine IS NOT TRUE THEN

    RAISE EXCEPTION 'NOT_TELEMEDICINE';

  END IF;



  -- Reuse existing token if present

  IF v_apt.telemedicine_token IS NOT NULL THEN

    RETURN jsonb_build_object(

      'token', v_apt.telemedicine_token,

      'already_existed', true

    );

  END IF;



  -- Generate new token

  v_token := gen_random_uuid();



  UPDATE public.appointments

    SET telemedicine_token = v_token, updated_at = now()

    WHERE id = p_appointment_id;



  RETURN jsonb_build_object(

    'token', v_token,

    'already_existed', false

  );

END;

$function$;