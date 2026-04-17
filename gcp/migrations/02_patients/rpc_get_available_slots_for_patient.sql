CREATE OR REPLACE FUNCTION public.get_available_slots_for_patient(p_service_id uuid, p_professional_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(slot_date date, slot_time time without time zone, slot_datetime timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_client_id uuid;

  v_tenant_id uuid;

  v_service public.procedures%ROWTYPE;

  v_min_hours integer;

  v_max_days integer;

  v_min_datetime timestamptz;

  v_max_datetime timestamptz;

  v_current_date date;

  v_day_of_week integer;

  v_slot_start time;

  v_slot_end time;

  v_slot_datetime timestamptz;

  v_duration interval;

BEGIN

  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;



  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente n├úo vinculado a nenhuma cl├¡nica'; END IF;



  SELECT t.patient_booking_min_hours_advance, t.patient_booking_max_days_advance

  INTO v_min_hours, v_max_days

  FROM public.tenants t WHERE t.id = v_tenant_id;



  SELECT * INTO v_service

  FROM public.procedures s

  WHERE s.id = p_service_id AND s.tenant_id = v_tenant_id AND s.is_active = true;



  IF NOT FOUND THEN RAISE EXCEPTION 'Servi├ºo n├úo encontrado'; END IF;



  v_duration := make_interval(mins => v_service.duration_minutes);

  v_min_datetime := now() + make_interval(hours => v_min_hours);

  v_max_datetime := now() + make_interval(days => v_max_days);



  IF p_date_from < v_min_datetime::date THEN v_current_date := v_min_datetime::date;

  ELSE v_current_date := p_date_from; END IF;



  IF p_date_to > v_max_datetime::date THEN p_date_to := v_max_datetime::date; END IF;



  WHILE v_current_date <= p_date_to LOOP

    v_day_of_week := EXTRACT(DOW FROM v_current_date)::integer;



    FOR v_slot_start, v_slot_end IN

      SELECT wh.start_time, wh.end_time

      FROM public.professional_working_hours wh

      WHERE wh.tenant_id = v_tenant_id

        AND wh.professional_id = p_professional_id

        AND wh.day_of_week = v_day_of_week

        AND wh.is_active = true

    LOOP

      WHILE v_slot_start + v_duration <= v_slot_end LOOP

        v_slot_datetime := v_current_date + v_slot_start;



        IF v_slot_datetime >= v_min_datetime THEN

          IF NOT EXISTS (

            SELECT 1 FROM public.appointments a

            WHERE a.tenant_id = v_tenant_id

              AND a.professional_id = p_professional_id

              AND a.status NOT IN ('cancelled')

              AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')

                  && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')

          ) THEN

            IF NOT EXISTS (

              SELECT 1 FROM public.schedule_blocks sb

              WHERE sb.tenant_id = v_tenant_id

                AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)

                AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')

            ) THEN

              slot_date := v_current_date;

              slot_time := v_slot_start;

              slot_datetime := v_slot_datetime;

              RETURN NEXT;

            END IF;

          END IF;

        END IF;



        v_slot_start := v_slot_start + interval '30 minutes';

      END LOOP;

    END LOOP;



    v_current_date := v_current_date + 1;

  END LOOP;

END;

$function$;