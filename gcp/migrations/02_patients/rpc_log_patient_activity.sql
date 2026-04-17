CREATE OR REPLACE FUNCTION public.log_patient_activity(p_event_type text, p_event_description text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id UUID := current_setting('app.current_user_id')::uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN;  -- Silencioso se n├úo autenticado

  END IF;



  -- Validar event_type

  IF p_event_type NOT IN (

    'login', 'profile_update', 'exam_download', 'prescription_view',

    'consent_sign', 'data_export', 'deletion_request', 'mfa_change',

    'settings_update', 'report_view', 'certificate_view', 'logout'

  ) THEN

    RETURN;  -- Tipo desconhecido, ignorar silenciosamente

  END IF;



  INSERT INTO public.patient_activity_log (

    patient_user_id, event_type, event_description, metadata

  )

  VALUES (

    v_user_id,

    p_event_type,

    left(p_event_description, 500),

    p_metadata

  );

END;

$function$;