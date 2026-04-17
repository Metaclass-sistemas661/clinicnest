CREATE OR REPLACE FUNCTION public.create_walkin_order_v1(p_client_id uuid DEFAULT NULL::uuid, p_professional_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id     uuid := current_setting('app.current_user_id')::uuid;

  v_profile     public.profiles%rowtype;

  v_is_admin    boolean;

  v_prof_id     uuid;

  v_apt_id      uuid;

  v_order_id    uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';

  END IF;



  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);



  -- Determine professional

  IF v_is_admin THEN

    v_prof_id := COALESCE(p_professional_id, v_profile.id);

  ELSE

    v_prof_id := v_profile.id;

  END IF;



  -- Validate professional belongs to tenant

  IF v_prof_id IS NOT NULL AND NOT EXISTS (

    SELECT 1 FROM public.profiles WHERE id = v_prof_id AND tenant_id = v_profile.tenant_id

  ) THEN

    RAISE EXCEPTION 'Profissional inv├ílido' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  -- Create walk-in appointment (no conflict check needed ÔÇö walk-in has no slot)

  INSERT INTO public.appointments (

    tenant_id, client_id, professional_id,

    scheduled_at, duration_minutes, status, price, notes, source

  ) VALUES (

    v_profile.tenant_id, p_client_id, v_prof_id,

    now(), 0, 'confirmed', 0, p_notes, 'walk_in'

  )

  RETURNING id INTO v_apt_id;



  -- Create order

  INSERT INTO public.orders (

    tenant_id, appointment_id, client_id, professional_id,

    status, created_by

  ) VALUES (

    v_profile.tenant_id, v_apt_id, p_client_id, v_prof_id,

    'open', v_user_id

  )

  RETURNING id INTO v_order_id;



  -- Audit

  PERFORM public.log_tenant_action(

    v_profile.tenant_id, v_user_id,

    'walkin_order_created', 'order', v_order_id::text,

    jsonb_build_object('appointment_id', v_apt_id, 'client_id', p_client_id)

  );



  RETURN jsonb_build_object(

    'success', true,

    'order_id', v_order_id,

    'appointment_id', v_apt_id

  );

END;

$function$;