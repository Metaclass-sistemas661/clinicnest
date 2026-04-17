CREATE OR REPLACE FUNCTION public.patient_create_appointment(p_procedure_id uuid, p_professional_id uuid, p_scheduled_at timestamp with time zone, p_for_dependent_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_tenant_id uuid;

  v_service public.procedures%ROWTYPE;

  v_tenant public.tenants%ROWTYPE;

  v_pending_count integer;

  v_min_datetime timestamptz;

  v_max_datetime timestamptz;

  v_end_at timestamptz;

  v_has_conflict boolean;

  v_blocked boolean;

  v_within boolean;

  v_appointment_id uuid;

  v_booked_for uuid;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado a nenhuma cl├¡nica'; END IF;



  IF p_for_dependent_id IS NOT NULL THEN

    IF NOT EXISTS (

      SELECT 1 FROM public.patient_dependents pd

      WHERE pd.id = p_for_dependent_id

        AND pd.parent_patient_id = v_client_id

        AND pd.is_active = true

    ) THEN

      RAISE EXCEPTION 'Dependente n├úo encontrado';

    END IF;

    SELECT pd.dependent_patient_id INTO v_booked_for

    FROM public.patient_dependents pd WHERE pd.id = p_for_dependent_id;

  ELSE

    v_booked_for := v_client_id;

  END IF;



  SELECT * INTO v_tenant FROM public.tenants t WHERE t.id = v_tenant_id;



  IF NOT v_tenant.patient_booking_enabled THEN

    RAISE EXCEPTION 'Agendamento online n├úo est├í habilitado para esta cl├¡nica';

  END IF;



  SELECT COUNT(*) INTO v_pending_count

  FROM public.appointments a

  WHERE a.tenant_id = v_tenant_id

    AND a.patient_id = v_booked_for

    AND a.status IN ('pending', 'confirmed')

    AND a.scheduled_at > now();



  IF v_pending_count >= v_tenant.patient_booking_max_pending_per_patient THEN

    RAISE EXCEPTION 'Limite de % agendamentos pendentes atingido', v_tenant.patient_booking_max_pending_per_patient;

  END IF;



  SELECT * INTO v_service

  FROM public.procedures s

  WHERE s.id = p_procedure_id AND s.tenant_id = v_tenant_id AND s.is_active = true AND s.patient_bookable = true;



  IF NOT FOUND THEN RAISE EXCEPTION 'Servi├ºo n├úo dispon├¡vel para agendamento online'; END IF;



  IF NOT EXISTS (

    SELECT 1 FROM public.profiles p

    WHERE p.id = p_professional_id AND p.tenant_id = v_tenant_id AND p.patient_bookable = true

  ) THEN

    RAISE EXCEPTION 'Profissional n├úo dispon├¡vel para agendamento online';

  END IF;



  v_min_datetime := now() + make_interval(hours => v_tenant.patient_booking_min_hours_advance);

  v_max_datetime := now() + make_interval(days => v_tenant.patient_booking_max_days_advance);



  IF p_scheduled_at < v_min_datetime THEN

    RAISE EXCEPTION 'Agendamento deve ser feito com pelo menos % horas de anteced├¬ncia', v_tenant.patient_booking_min_hours_advance;

  END IF;

  IF p_scheduled_at > v_max_datetime THEN

    RAISE EXCEPTION 'Agendamento deve ser feito com no m├íximo % dias de anteced├¬ncia', v_tenant.patient_booking_max_days_advance;

  END IF;



  v_end_at := p_scheduled_at + make_interval(mins => v_service.duration_minutes);



  BEGIN

    v_within := public.is_slot_within_working_hours_v1(v_tenant_id, p_professional_id, p_scheduled_at, v_end_at);

    IF v_within IS DISTINCT FROM true THEN

      RAISE EXCEPTION 'Hor├írio fora do expediente do profissional';

    END IF;

  EXCEPTION WHEN undefined_function THEN

    NULL;

  END;



  SELECT EXISTS(

    SELECT 1 FROM public.schedule_blocks sb

    WHERE sb.tenant_id = v_tenant_id

      AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)

      AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(p_scheduled_at, v_end_at, '[)')

  ) INTO v_blocked;



  IF v_blocked THEN RAISE EXCEPTION 'Hor├írio bloqueado na agenda'; END IF;



  SELECT EXISTS(

    SELECT 1 FROM public.appointments a

    WHERE a.tenant_id = v_tenant_id

      AND a.professional_id = p_professional_id

      AND a.status NOT IN ('cancelled')

      AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')

          && tstzrange(p_scheduled_at, v_end_at, '[)')

  ) INTO v_has_conflict;



  IF v_has_conflict THEN RAISE EXCEPTION 'Este hor├írio n├úo est├í mais dispon├¡vel'; END IF;



  INSERT INTO public.appointments (

    tenant_id, patient_id, procedure_id, professional_id,

    scheduled_at, duration_minutes, status, price

  ) VALUES (

    v_tenant_id, v_booked_for, v_service.id, p_professional_id,

    p_scheduled_at, v_service.duration_minutes, 'pending', v_service.price

  )

  RETURNING id INTO v_appointment_id;



  RETURN jsonb_build_object(

    'success', true,

    'appointment_id', v_appointment_id,

    'message', 'Agendamento realizado com sucesso! Aguarde a confirma├º├úo da cl├¡nica.'

  );

END;

$function$;