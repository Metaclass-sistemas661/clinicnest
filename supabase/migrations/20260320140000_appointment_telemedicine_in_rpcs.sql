-- Add p_telemedicine parameter to create_appointment_v2 and update_appointment_v2
-- so telemedicine flag is set atomically during creation/update instead of a separate UPDATE call.

CREATE OR REPLACE FUNCTION public.create_appointment_v2(
  p_scheduled_at timestamptz,
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_status public.appointment_status DEFAULT 'pending',
  p_notes text DEFAULT NULL,
  p_telemedicine boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
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
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at é obrigatório';
  END IF;

  v_duration := COALESCE(p_duration_minutes, 30);
  IF v_duration <= 0 OR v_duration > 24*60 THEN
    RAISE EXCEPTION 'duration_minutes inválido';
  END IF;

  v_price := COALESCE(p_price, 0);
  IF v_price < 0 THEN
    RAISE EXCEPTION 'price não pode ser negativo';
  END IF;

  IF p_status IS NULL THEN
    p_status := 'pending';
  END IF;

  IF p_status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Status inicial inválido';
  END IF;

  IF v_is_admin THEN
    v_professional_id := COALESCE(p_professional_profile_id, v_profile.id);
  ELSE
    v_professional_id := v_profile.id;
  END IF;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'professional_id é obrigatório';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant';
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
    RAISE EXCEPTION 'Conflito de horário' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    professional_id,
    scheduled_at,
    duration_minutes,
    status,
    price,
    notes,
    telemedicine
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
    COALESCE(p_telemedicine, FALSE)
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
      'telemedicine', COALESCE(p_telemedicine, FALSE)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'status', p_status
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.update_appointment_v2(
  p_appointment_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_telemedicine boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_apt public.appointments%rowtype;
  v_new_professional_id uuid;
  v_new_scheduled_at timestamptz;
  v_new_duration integer;
  v_new_price numeric;
  v_new_telemedicine boolean;
  v_end_at timestamptz;
  v_lock_key text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('update_appointment_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para editar este agendamento';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido editar um agendamento concluído';
  END IF;

  v_new_telemedicine := COALESCE(p_telemedicine, v_apt.telemedicine);

  IF v_apt.status = 'confirmed' THEN
    UPDATE public.appointments
    SET notes = NULLIF(p_notes, ''),
        telemedicine = v_new_telemedicine,
        updated_at = now()
    WHERE id = v_apt.id
      AND tenant_id = v_profile.tenant_id;

    PERFORM public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'appointment_notes_updated',
      'appointment',
      v_apt.id::text,
      jsonb_build_object('notes_only', true, 'telemedicine', v_new_telemedicine)
    );

    RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'notes_only', true);
  END IF;

  IF v_is_admin THEN
    v_new_professional_id := COALESCE(p_professional_profile_id, v_apt.professional_id);
  ELSE
    v_new_professional_id := v_profile.id;
  END IF;

  v_new_scheduled_at := COALESCE(p_scheduled_at, v_apt.scheduled_at);
  v_new_duration := COALESCE(p_duration_minutes, v_apt.duration_minutes);
  v_new_price := COALESCE(p_price, v_apt.price);

  IF v_new_duration <= 0 OR v_new_duration > 24*60 THEN
    RAISE EXCEPTION 'duration_minutes inválido';
  END IF;

  IF v_new_price < 0 THEN
    RAISE EXCEPTION 'price não pode ser negativo';
  END IF;

  IF v_new_professional_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_new_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant';
  END IF;

  v_end_at := v_new_scheduled_at + make_interval(mins => v_new_duration);

  v_lock_key := v_profile.tenant_id::text || ':' || v_new_professional_id::text || ':' || to_char(v_new_scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key), hashtext('update_appointment_v2_conflict'));

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.tenant_id = v_profile.tenant_id
      AND a.professional_id = v_new_professional_id
      AND a.id <> v_apt.id
      AND a.status <> 'cancelled'
      AND a.scheduled_at < v_end_at
      AND (a.scheduled_at + make_interval(mins => a.duration_minutes)) > v_new_scheduled_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Conflito de horário' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.appointments
  SET client_id = p_client_id,
      service_id = p_service_id,
      professional_id = v_new_professional_id,
      scheduled_at = v_new_scheduled_at,
      duration_minutes = v_new_duration,
      price = v_new_price,
      notes = NULLIF(p_notes, ''),
      telemedicine = v_new_telemedicine,
      telemedicine_url = CASE WHEN v_new_telemedicine THEN telemedicine_url ELSE NULL END,
      updated_at = now()
  WHERE id = v_apt.id
    AND tenant_id = v_profile.tenant_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_updated',
    'appointment',
    v_apt.id::text,
    jsonb_build_object(
      'scheduled_at', v_new_scheduled_at,
      'professional_id', v_new_professional_id,
      'telemedicine', v_new_telemedicine
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_apt.id
  );
END;
$$;
