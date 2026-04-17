CREATE OR REPLACE FUNCTION public.submit_appointment_rating(p_appointment_id uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid;

  v_client_id uuid;

  v_tenant_id uuid;

  v_appointment public.appointments%ROWTYPE;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado'; END IF;



  SELECT * INTO v_appointment

  FROM public.appointments a

  WHERE a.id = p_appointment_id

    AND a.patient_id = v_client_id

    AND a.tenant_id = v_tenant_id;



  IF NOT FOUND THEN RAISE EXCEPTION 'Consulta n├úo encontrada'; END IF;



  IF v_appointment.status != 'completed' THEN

    RAISE EXCEPTION 'Apenas consultas conclu├¡das podem ser avaliadas';

  END IF;



  IF EXISTS (SELECT 1 FROM public.appointment_ratings WHERE appointment_id = p_appointment_id) THEN

    RAISE EXCEPTION 'Esta consulta j├í foi avaliada';

  END IF;



  IF p_rating < 1 OR p_rating > 5 THEN

    RAISE EXCEPTION 'Avalia├º├úo deve ser entre 1 e 5';

  END IF;



  INSERT INTO public.appointment_ratings (

    tenant_id, appointment_id, patient_user_id, rating, comment

  ) VALUES (

    v_tenant_id, p_appointment_id, v_user_id, p_rating, NULLIF(BTRIM(p_comment), '')

  );



  RETURN jsonb_build_object('success', true, 'message', 'Obrigado pela sua avalia├º├úo!');

END;

$function$;