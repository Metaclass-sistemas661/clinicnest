CREATE OR REPLACE FUNCTION public.get_patient_telemedicine_appointments(p_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE v_user_id uuid := current_setting('app.current_user_id')::uuid; v_result jsonb;

BEGIN

  SELECT COALESCE(jsonb_agg(row_to_json(r)),'[]'::jsonb) INTO v_result

  FROM (

    SELECT a.id, a.tenant_id, a.scheduled_at, a.duration_minutes, a.status, s.name AS service_name, p.full_name AS professional_name, t.name AS clinic_name

    FROM public.appointments a

    JOIN public.patient_profiles pp ON pp.tenant_id=a.tenant_id AND pp.client_id=a.patient_id

    LEFT JOIN public.procedures s ON s.id=a.procedure_id

    LEFT JOIN public.profiles p ON p.id=a.professional_id

    LEFT JOIN public.tenants t ON t.id=a.tenant_id

    WHERE pp.user_id=v_user_id AND pp.is_active=true AND a.telemedicine=true AND a.status IN ('pending','confirmed')

      AND a.scheduled_at >= p_date::timestamptz AND a.scheduled_at < (p_date+interval '1 day')::timestamptz

    ORDER BY a.scheduled_at

  ) r;

  RETURN v_result;

END;

$function$;