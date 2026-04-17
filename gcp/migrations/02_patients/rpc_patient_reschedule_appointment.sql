CREATE OR REPLACE FUNCTION public.patient_reschedule_appointment(p_appointment_id uuid, p_new_scheduled_at timestamp with time zone, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id    uuid := current_setting('app.current_user_id')::uuid;

  v_apt        public.appointments%ROWTYPE;

  v_linked     boolean;

  v_hours      numeric;

  v_conflict   boolean;

  v_end_time   timestamptz;

  v_client_name text;

  v_service_name text;

  v_professional_user_id uuid;

  v_admin_users uuid[];

  v_old_scheduled_at timestamptz;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  SELECT a.* INTO v_apt

  FROM public.appointments a

  WHERE a.id = p_appointment_id;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Consulta n├úo encontrada';

  END IF;



  SELECT EXISTS(

    SELECT 1 FROM public.patient_profiles pp

    WHERE pp.user_id = v_user_id

      AND pp.tenant_id = v_apt.tenant_id

      AND pp.client_id = v_apt.client_id

      AND pp.is_active = true

  ) INTO v_linked;



  IF NOT v_linked THEN

    RAISE EXCEPTION 'Sem permiss├úo para reagendar esta consulta';

  END IF;



  IF v_apt.status NOT IN ('pending', 'confirmed') THEN

    RAISE EXCEPTION 'S├│ ├® poss├¡vel reagendar consultas pendentes ou confirmadas. Status atual: %', v_apt.status;

  END IF;



  v_hours := EXTRACT(EPOCH FROM (v_apt.scheduled_at - now())) / 3600.0;

  IF v_hours < 24 THEN

    RAISE EXCEPTION 'Reagendamento deve ser feito com pelo menos 24 horas de anteced├¬ncia (faltam %.0f horas)', v_hours;

  END IF;



  IF p_new_scheduled_at <= now() + interval '1 hour' THEN

    RAISE EXCEPTION 'A nova data deve ser pelo menos 1 hora no futuro';

  END IF;



  v_end_time := p_new_scheduled_at + (v_apt.duration_minutes || ' minutes')::interval;



  SELECT EXISTS(

    SELECT 1 FROM public.appointments a2

    WHERE a2.tenant_id = v_apt.tenant_id

      AND a2.professional_id = v_apt.professional_id

      AND a2.id <> v_apt.id

      AND a2.status IN ('pending', 'confirmed')

      AND a2.scheduled_at < v_end_time

      AND (a2.scheduled_at + (a2.duration_minutes || ' minutes')::interval) > p_new_scheduled_at

  ) INTO v_conflict;



  IF v_conflict THEN

    RAISE EXCEPTION 'O profissional j├í possui outro agendamento neste hor├írio. Escolha outro hor├írio.';

  END IF;



  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('patient_reschedule'));



  -- Store old scheduled_at for notification

  v_old_scheduled_at := v_apt.scheduled_at;



  -- Get client and service names for notification

  SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = v_apt.client_id;

  SELECT s.name INTO v_service_name FROM public.services s WHERE s.id = v_apt.service_id;

  SELECT p.user_id INTO v_professional_user_id FROM public.profiles p WHERE p.id = v_apt.professional_id;



  UPDATE public.appointments

    SET scheduled_at = p_new_scheduled_at,

        status = 'pending',

        updated_at = now(),

        notes = CASE

          WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN COALESCE(notes, '') || E'\n[Reagendado pelo paciente via portal]'

          ELSE COALESCE(notes, '') || E'\n[Reagendado pelo paciente]: ' || p_reason

        END

  WHERE id = v_apt.id;



  -- Notify the professional

  IF v_professional_user_id IS NOT NULL THEN

    INSERT INTO public.notifications (tenant_id, user_id, type, title, body, metadata)

    VALUES (

      v_apt.tenant_id,

      v_professional_user_id,

      'appointment_rescheduled_by_patient',

      'Consulta reagendada pelo paciente',

      format('%s reagendou a consulta de %s de %s para %s', 

        v_client_name, 

        v_service_name,

        to_char(v_old_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "├ás" HH24:MI'),

        to_char(p_new_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "├ás" HH24:MI')

      ),

      jsonb_build_object(

        'appointment_id', v_apt.id,

        'client_name', v_client_name,

        'service_name', v_service_name,

        'old_scheduled_at', v_old_scheduled_at,

        'new_scheduled_at', p_new_scheduled_at,

        'reason', p_reason

      )

    );

  END IF;



  -- Notify admins

  SELECT array_agg(ur.user_id) INTO v_admin_users

  FROM public.user_roles ur

  WHERE ur.tenant_id = v_apt.tenant_id

    AND ur.role = 'admin'

    AND ur.user_id <> COALESCE(v_professional_user_id, '00000000-0000-0000-0000-000000000000'::uuid);



  IF v_admin_users IS NOT NULL AND array_length(v_admin_users, 1) > 0 THEN

    INSERT INTO public.notifications (tenant_id, user_id, type, title, body, metadata)

    SELECT 

      v_apt.tenant_id,

      admin_id,

      'appointment_rescheduled_by_patient',

      'Consulta reagendada pelo paciente',

      format('%s reagendou a consulta de %s de %s para %s', 

        v_client_name, 

        v_service_name,

        to_char(v_old_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "├ás" HH24:MI'),

        to_char(p_new_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "├ás" HH24:MI')

      ),

      jsonb_build_object(

        'appointment_id', v_apt.id,

        'client_name', v_client_name,

        'service_name', v_service_name,

        'old_scheduled_at', v_old_scheduled_at,

        'new_scheduled_at', p_new_scheduled_at,

        'reason', p_reason

      )

    FROM unnest(v_admin_users) AS admin_id;

  END IF;



  RETURN jsonb_build_object(

    'success', true,

    'appointment_id', v_apt.id,

    'new_scheduled_at', p_new_scheduled_at,

    'message', 'Consulta reagendada com sucesso'

  );

END;

$function$;