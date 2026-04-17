CREATE OR REPLACE FUNCTION public.update_patient_onboarding(p_tour_completed boolean DEFAULT NULL::boolean, p_tour_skipped boolean DEFAULT NULL::boolean)
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

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  -- Upsert onboarding record

  INSERT INTO public.patient_onboarding (patient_user_id, last_login_at, login_count)

  VALUES (v_patient_user_id, now(), 1)

  ON CONFLICT (patient_user_id) DO UPDATE SET

    last_login_at = now(),

    login_count = patient_onboarding.login_count + 1,

    tour_completed = COALESCE(p_tour_completed, patient_onboarding.tour_completed),

    tour_completed_at = CASE WHEN p_tour_completed = true THEN now() ELSE patient_onboarding.tour_completed_at END,

    tour_skipped = COALESCE(p_tour_skipped, patient_onboarding.tour_skipped)

  RETURNING * INTO v_onboarding;



  RETURN jsonb_build_object(

    'tour_completed', v_onboarding.tour_completed,

    'tour_skipped', v_onboarding.tour_skipped,

    'login_count', v_onboarding.login_count,

    'first_login_at', v_onboarding.first_login_at

  );

END;

$function$;