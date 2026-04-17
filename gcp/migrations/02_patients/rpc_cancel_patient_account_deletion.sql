CREATE OR REPLACE FUNCTION public.cancel_patient_account_deletion()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_request RECORD;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'N├úo autenticado');

  END IF;



  SELECT id INTO v_request

  FROM public.patient_deletion_requests

  WHERE user_id = v_user_id AND status = 'pending'

  ORDER BY requested_at DESC

  LIMIT 1;



  IF v_request IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma solicita├º├úo pendente encontrada');

  END IF;



  UPDATE public.patient_deletion_requests

  SET status = 'cancelled', cancelled_at = now()

  WHERE id = v_request.id;



  RETURN jsonb_build_object('success', true, 'message', 'Solicita├º├úo de exclus├úo cancelada com sucesso');

END;

$function$;