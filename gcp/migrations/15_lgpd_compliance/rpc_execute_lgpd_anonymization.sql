CREATE OR REPLACE FUNCTION public.execute_lgpd_anonymization(p_tenant_id uuid, p_target_user_id uuid, p_confirmation_token text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_target_profile_id UUID;

  v_expected_token TEXT;



  v_profile_rows INTEGER := 0;

  v_notifications_rows INTEGER := 0;

  v_appointments_rows INTEGER := 0;

  v_goal_suggestions_rows INTEGER := 0;

  v_commission_rows INTEGER := 0;

  v_salary_rows INTEGER := 0;

  v_lgpd_rows INTEGER := 0;

  v_request_marked_rows INTEGER := 0;

BEGIN

  IF v_requester_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF NOT public.is_tenant_admin(v_requester_user_id, p_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem executar anonimiza├º├úo';

  END IF;



  SELECT p.id

  INTO v_target_profile_id

  FROM public.profiles p

  WHERE p.user_id = p_target_user_id

    AND p.tenant_id = p_tenant_id

  LIMIT 1;



  IF v_target_profile_id IS NULL THEN

    RAISE EXCEPTION 'Titular n├úo encontrado neste tenant';

  END IF;



  v_expected_token := 'ANONYMIZE:' || p_target_user_id::text;

  IF COALESCE(p_confirmation_token, '') <> v_expected_token THEN

    RAISE EXCEPTION 'Token de confirma├º├úo inv├ílido para anonimiza├º├úo';

  END IF;



  UPDATE public.profiles

  SET

    full_name = 'Titular anonimizado',

    email = NULL,

    phone = NULL,

    avatar_url = NULL,

    updated_at = now()

  WHERE tenant_id = p_tenant_id

    AND user_id = p_target_user_id;

  GET DIAGNOSTICS v_profile_rows = ROW_COUNT;



  UPDATE public.notifications

  SET

    title = 'Notifica├º├úo anonimizada',

    body = NULL,

    metadata = '{}'::jsonb

  WHERE tenant_id = p_tenant_id

    AND user_id = p_target_user_id;

  GET DIAGNOSTICS v_notifications_rows = ROW_COUNT;



  UPDATE public.appointments

  SET notes = NULL, updated_at = now()

  WHERE tenant_id = p_tenant_id

    AND professional_id = v_target_profile_id

    AND notes IS NOT NULL;

  GET DIAGNOSTICS v_appointments_rows = ROW_COUNT;



  UPDATE public.goal_suggestions

  SET

    name = NULL,

    rejection_reason = NULL

  WHERE tenant_id = p_tenant_id

    AND professional_id = v_target_profile_id

    AND (name IS NOT NULL OR rejection_reason IS NOT NULL);

  GET DIAGNOSTICS v_goal_suggestions_rows = ROW_COUNT;



  UPDATE public.commission_payments

  SET

    notes = NULL,

    updated_at = now()

  WHERE tenant_id = p_tenant_id

    AND professional_id = p_target_user_id

    AND notes IS NOT NULL;

  GET DIAGNOSTICS v_commission_rows = ROW_COUNT;



  UPDATE public.salary_payments

  SET

    notes = NULL,

    payment_reference = NULL,

    updated_at = now()

  WHERE tenant_id = p_tenant_id

    AND professional_id = p_target_user_id

    AND (notes IS NOT NULL OR payment_reference IS NOT NULL);

  GET DIAGNOSTICS v_salary_rows = ROW_COUNT;



  UPDATE public.lgpd_data_requests

  SET

    requester_email = NULL,

    request_details = '[ANONIMIZADO]',

    updated_at = now()

  WHERE tenant_id = p_tenant_id

    AND requester_user_id = p_target_user_id

    AND (requester_email IS NOT NULL OR request_details IS NOT NULL);

  GET DIAGNOSTICS v_lgpd_rows = ROW_COUNT;



  IF p_request_id IS NOT NULL THEN

    UPDATE public.lgpd_data_requests

    SET

      status = 'completed',

      assigned_admin_user_id = v_requester_user_id,

      resolved_at = now(),

      resolution_notes = trim(

        BOTH FROM (

          COALESCE(resolution_notes || E'\n', '') ||

          'Anonimiza├º├úo executada em ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS')

        )

      ),

      updated_at = now()

    WHERE id = p_request_id

      AND tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_request_marked_rows = ROW_COUNT;

  END IF;



  PERFORM public.log_admin_action(

    p_tenant_id,

    'lgpd_anonymization_executed',

    'profiles',

    p_target_user_id::text,

    jsonb_build_object(

      'profile_rows', v_profile_rows,

      'notifications_rows', v_notifications_rows,

      'appointments_rows', v_appointments_rows,

      'goal_suggestions_rows', v_goal_suggestions_rows,

      'commission_rows', v_commission_rows,

      'salary_rows', v_salary_rows,

      'lgpd_rows', v_lgpd_rows,

      'request_marked_rows', v_request_marked_rows

    )

  );



  RETURN jsonb_build_object(

    'success', true,

    'request_marked_completed', (v_request_marked_rows > 0),

    'summary', jsonb_build_object(

      'profile_rows', v_profile_rows,

      'notifications_rows', v_notifications_rows,

      'appointments_rows', v_appointments_rows,

      'goal_suggestions_rows', v_goal_suggestions_rows,

      'commission_rows', v_commission_rows,

      'salary_rows', v_salary_rows,

      'lgpd_rows', v_lgpd_rows

    )

  );

END;

$function$;