CREATE OR REPLACE FUNCTION public.get_appointment_by_telemedicine_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_result jsonb;

BEGIN

  SELECT jsonb_build_object(

    'id', a.id,

    'tenant_id', a.tenant_id,

    'scheduled_at', a.scheduled_at,

    'duration_minutes', a.duration_minutes,

    'status', a.status,

    'service_name', COALESCE(s.name, ''),

    'professional_name', COALESCE(p.full_name, ''),

    'clinic_name', COALESCE(t.name, ''),

    'client_name', COALESCE(c.name, '')

  )

  INTO v_result

  FROM public.appointments a

  LEFT JOIN public.services s ON s.id = a.service_id

  LEFT JOIN public.profiles p ON p.id = a.professional_id

  LEFT JOIN public.tenants t ON t.id = a.tenant_id

  LEFT JOIN public.clients c ON c.id = a.client_id

  WHERE a.telemedicine_token = p_token

    AND a.telemedicine = true

    AND a.status IN ('pending', 'confirmed');



  IF v_result IS NULL THEN

    RETURN jsonb_build_object('error', 'TOKEN_INVALID_OR_EXPIRED');

  END IF;



  RETURN v_result;

END;

$function$;