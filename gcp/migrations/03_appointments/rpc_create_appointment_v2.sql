CREATE OR REPLACE FUNCTION public.create_appointment_v2(p_scheduled_at timestamp with time zone, p_client_id uuid DEFAULT NULL::uuid, p_service_id uuid DEFAULT NULL::uuid, p_professional_profile_id uuid DEFAULT NULL::uuid, p_duration_minutes integer DEFAULT NULL::integer, p_price numeric DEFAULT NULL::numeric, p_status appointment_status DEFAULT 'pending'::appointment_status, p_notes text DEFAULT NULL::text, p_telemedicine boolean DEFAULT false, p_booked_by_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_is_admin boolean := false;

  v_professional_id uuid;

  v_duration integer;

  v_price numeric;

  v_end_at timestamptz;

  v_appointment_id uuid;

  v_lock_key text;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  SELECT * INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado';

  END IF;



  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);



  IF p_scheduled_at IS NULL THEN

    RAISE EXCEPTION 'scheduled_at ├® obrigat├│rio';

  END IF;



  v_duration := COALESCE(p_duration_minutes, 30);

  IF v_duration <= 0 OR v_duration > 24*60 THEN

    RAISE EXCEPTION 'duration_minutes inv├ílido';

  END IF;



  v_price := COALESCE(p_price, 0);

  IF v_price < 0 THEN

    RAISE EXCEPTION 'price n├úo pode ser negativo';

  END IF;



  IF p_status IS NULL THEN

    p_status := 'pending';

  END IF;



  IF p_status NOT IN ('pending','confirmed') THEN

    RAISE EXCEPTION 'Status inicial inv├ílido';

  END IF;



  IF v_is_admin THEN

    v_professional_id := COALESCE(p_professional_profile_id, v_profile.id);

  ELSE

    v_professional_id := v_profile.id;

  END IF;



  IF v_professional_id IS NULL THEN

    RAISE EXCEPTION 'professional_id ├® obrigat├│rio';

  END IF;



  IF NOT EXISTS (

    SELECT 1 FROM public.profiles p

    WHERE p.id = v_professional_id

      AND p.tenant_id = v_profile.tenant_id

  ) THEN

    RAISE EXCEPTION 'Profissional inv├ílido para o tenant';

  END IF;



  v_end_at := p_scheduled_at + make_interval(mins => v_duration);



  v_lock_key := v_profile.tenant_id::text || ':' || v_professional_id::text || ':' || to_char(p_scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key), hashtext('create_appointment_v2'));



  IF EXISTS (

    SELECT 1

    FROM public.appointments a

    WHERE a.tenant_id = v_profile.tenant_id

      AND a.professional_id = v_professional_id

      AND a.status <> 'cancelled'

      AND a.scheduled_at < v_end_at

      AND (a.scheduled_at + make_interval(mins => a.duration_minutes)) > p_scheduled_at

    LIMIT 1

  ) THEN

    RAISE EXCEPTION 'Conflito de hor├írio' USING ERRCODE = 'P0001';

  END IF;



  INSERT INTO public.appointments (

    tenant_id,

    patient_id,

    procedure_id,

    professional_id,

    scheduled_at,

    duration_minutes,

    status,

    price,

    notes,

    telemedicine,

    booked_by_id

  ) VALUES (

    v_profile.tenant_id,

    p_client_id,

    p_service_id,

    v_professional_id,

    p_scheduled_at,

    v_duration,

    p_status,

    v_price,

    NULLIF(p_notes, ''),

    COALESCE(p_telemedicine, FALSE),

    p_booked_by_id

  )

  RETURNING id INTO v_appointment_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'appointment_created',

    'appointment',

    v_appointment_id::text,

    jsonb_build_object(

      'scheduled_at', p_scheduled_at,

      'professional_id', v_professional_id,

      'service_id', p_service_id,

      'client_id', p_client_id,

      'telemedicine', COALESCE(p_telemedicine, FALSE),

      'booked_by_id', p_booked_by_id

    )

  );



  RETURN jsonb_build_object(

    'success', true,

    'appointment_id', v_appointment_id,

    'status', p_status

  );

END;

$function$;