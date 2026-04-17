CREATE OR REPLACE FUNCTION public.get_patient_onboarding_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_patient_user_id uuid;

  v_onboarding public.patient_onboarding%ROWTYPE;

BEGIN

  v_patient_user_id := current_setting('app.current_user_id')::uuid;

  IF v_patient_user_id IS NULL THEN

    RETURN jsonb_build_object('is_new', true);

  END IF;



  SELECT * INTO v_onboarding

  FROM public.patient_onboarding

  WHERE patient_user_id = v_patient_user_id;



  IF NOT FOUND THEN

    RETURN jsonb_build_object('is_new', true, 'show_tour', true);

  END IF;



  RETURN jsonb_build_object(

    'is_new', false,

    'show_tour', NOT v_onboarding.tour_completed AND NOT v_onboarding.tour_skipped,

    'tour_completed', v_onboarding.tour_completed,

    'login_count', v_onboarding.login_count

  );

END;

$function$;