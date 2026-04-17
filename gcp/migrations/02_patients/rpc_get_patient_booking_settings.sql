CREATE OR REPLACE FUNCTION public.get_patient_booking_settings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_tenant_id uuid;

  v_tenant public.tenants%ROWTYPE;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true

  LIMIT 1;



  IF v_client_id IS NULL THEN

    RETURN jsonb_build_object('enabled', false, 'reason', 'not_linked');

  END IF;



  SELECT * INTO v_tenant FROM public.tenants t WHERE t.id = v_tenant_id;



  RETURN jsonb_build_object(

    'enabled', v_tenant.patient_booking_enabled,

    'min_hours_advance', v_tenant.patient_booking_min_hours_advance,

    'max_days_advance', v_tenant.patient_booking_max_days_advance,

    'max_pending', v_tenant.patient_booking_max_pending_per_patient,

    'clinic_name', v_tenant.name

  );

END;

$function$;