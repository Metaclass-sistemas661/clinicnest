CREATE OR REPLACE FUNCTION public.request_patient_account_deletion(p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_patient RECORD;

  v_existing RECORD;

  v_request_id UUID;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'N├úo autenticado');

  END IF;



  -- Find patient

  SELECT id, tenant_id, name

  INTO v_patient

  FROM public.patients

  WHERE user_id = v_user_id

  LIMIT 1;



  IF v_patient IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Paciente n├úo encontrado');

  END IF;



  -- Check if there's already a pending request

  SELECT id INTO v_existing

  FROM public.patient_deletion_requests

  WHERE patient_id = v_patient.id AND status = 'pending'

  LIMIT 1;



  IF v_existing IS NOT NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'J├í existe uma solicita├º├úo de exclus├úo pendente');

  END IF;



  -- Create deletion request (30 days grace period)

  INSERT INTO public.patient_deletion_requests (patient_id, user_id, reason, tenant_id)

  VALUES (v_patient.id, v_user_id, p_reason, v_patient.tenant_id)

  RETURNING id INTO v_request_id;



  RETURN jsonb_build_object(

    'success', true,

    'request_id', v_request_id,

    'scheduled_for', (now() + interval '30 days'),

    'message', 'Sua solicita├º├úo foi registrada. Seus dados ser├úo removidos em 30 dias. Voc├¬ pode cancelar durante esse per├¡odo.'

  );

END;

$function$;