CREATE OR REPLACE FUNCTION public.preview_lgpd_anonymization(p_tenant_id uuid, p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_target_profile_id UUID;

  v_confirmation_token TEXT;

  v_is_target_admin BOOLEAN := FALSE;

  v_warnings JSONB := '[]'::jsonb;



  v_notifications_count INTEGER := 0;

  v_preferences_count INTEGER := 0;

  v_appointments_notes_count INTEGER := 0;

  v_goal_suggestions_count INTEGER := 0;

  v_commission_notes_count INTEGER := 0;

  v_salary_notes_count INTEGER := 0;

  v_lgpd_request_details_count INTEGER := 0;

BEGIN

  IF v_requester_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF NOT public.is_tenant_admin(v_requester_user_id, p_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem pr├®-visualizar anonimiza├º├úo';

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



  SELECT EXISTS (

    SELECT 1

    FROM public.user_roles ur

    WHERE ur.tenant_id = p_tenant_id

      AND ur.user_id = p_target_user_id

      AND ur.role = 'admin'

  )

  INTO v_is_target_admin;



  IF v_is_target_admin THEN

    v_warnings := v_warnings || jsonb_build_array(

      'O titular alvo possui perfil de administrador. Avalie impacto operacional antes de anonimizar.'

    );

  END IF;



  SELECT COUNT(*) INTO v_notifications_count

  FROM public.notifications n

  WHERE n.tenant_id = p_tenant_id

    AND n.user_id = p_target_user_id;



  SELECT COUNT(*) INTO v_preferences_count

  FROM public.user_notification_preferences unp

  WHERE unp.user_id = p_target_user_id;



  SELECT COUNT(*) INTO v_appointments_notes_count

  FROM public.appointments a

  WHERE a.tenant_id = p_tenant_id

    AND a.professional_id = v_target_profile_id

    AND a.notes IS NOT NULL;



  SELECT COUNT(*) INTO v_goal_suggestions_count

  FROM public.goal_suggestions gs

  WHERE gs.tenant_id = p_tenant_id

    AND gs.professional_id = v_target_profile_id

    AND (gs.name IS NOT NULL OR gs.rejection_reason IS NOT NULL);



  SELECT COUNT(*) INTO v_commission_notes_count

  FROM public.commission_payments cp

  WHERE cp.tenant_id = p_tenant_id

    AND cp.professional_id = p_target_user_id

    AND cp.notes IS NOT NULL;



  SELECT COUNT(*) INTO v_salary_notes_count

  FROM public.salary_payments sp

  WHERE sp.tenant_id = p_tenant_id

    AND sp.professional_id = p_target_user_id

    AND (sp.notes IS NOT NULL OR sp.payment_reference IS NOT NULL);



  SELECT COUNT(*) INTO v_lgpd_request_details_count

  FROM public.lgpd_data_requests lr

  WHERE lr.tenant_id = p_tenant_id

    AND lr.requester_user_id = p_target_user_id

    AND (lr.request_details IS NOT NULL OR lr.requester_email IS NOT NULL);



  v_confirmation_token := 'ANONYMIZE:' || p_target_user_id::text;



  RETURN jsonb_build_object(

    'target_user_id', p_target_user_id,

    'target_profile_id', v_target_profile_id,

    'confirmation_token', v_confirmation_token,

    'warnings', v_warnings,

    'summary', jsonb_build_object(

      'profile_rows', 1,

      'notifications_rows', v_notifications_count,

      'notification_preferences_rows', v_preferences_count,

      'appointments_notes_rows', v_appointments_notes_count,

      'goal_suggestions_rows', v_goal_suggestions_count,

      'commission_notes_rows', v_commission_notes_count,

      'salary_sensitive_rows', v_salary_notes_count,

      'lgpd_request_sensitive_rows', v_lgpd_request_details_count

    )

  );

END;

$function$;