-- Enterprise P0: Centralize Agenda/Financeiro writes via RPC + DB-enforced conflict checks + audit logs

-- Notes:
-- - staff can only act on own appointments
-- - confirmed appointments: only notes can be edited
-- - completed appointments can never be deleted
-- - deletes are allowed (admin always; staff only pending and own) with mandatory audit

CREATE OR REPLACE FUNCTION public.create_appointment_v2(
  p_scheduled_at timestamptz,
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_status public.appointment_status DEFAULT 'pending',
  p_notes text DEFAULT NULL
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

  -- Staff: always force to own profile id
  IF v_is_admin THEN
    v_professional_id := COALESCE(p_professional_profile_id, v_profile.id);
  ELSE
    v_professional_id := v_profile.id;
  END IF;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'professional_id é obrigatório';
  END IF;

  -- Ensure professional belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant';
  END IF;

  v_end_at := p_scheduled_at + make_interval(mins => v_duration);

  -- Concurrency control: lock per tenant+professional+date
  v_lock_key := v_profile.tenant_id::text || ':' || v_professional_id::text || ':' || to_char(p_scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key), hashtext('create_appointment_v2'));

  -- Conflict check: overlap for same professional, ignore cancelled
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
    notes
  ) VALUES (
    v_profile.tenant_id,
    p_client_id,
    p_service_id,
    v_professional_id,
    p_scheduled_at,
    v_duration,
    p_status,
    v_price,
    NULLIF(p_notes, '')
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
      'duration_minutes', v_duration,
      'status', p_status,
      'professional_profile_id', v_professional_id,
      'client_id', p_client_id,
      'service_id', p_service_id,
      'price', v_price
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'status', p_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_appointment_v2(timestamptz, uuid, uuid, uuid, integer, numeric, public.appointment_status, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_appointment_v2(timestamptz, uuid, uuid, uuid, integer, numeric, public.appointment_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_v2(timestamptz, uuid, uuid, uuid, integer, numeric, public.appointment_status, text) TO service_role;


CREATE OR REPLACE FUNCTION public.update_appointment_v2(
  p_appointment_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
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

  -- Permission: admin or owner professional
  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para editar este agendamento';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido editar um agendamento concluído';
  END IF;

  -- Confirmed: only notes can change
  IF v_apt.status = 'confirmed' THEN
    UPDATE public.appointments
    SET notes = NULLIF(p_notes, ''),
        updated_at = now()
    WHERE id = v_apt.id
      AND tenant_id = v_profile.tenant_id;

    PERFORM public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'appointment_notes_updated',
      'appointment',
      v_apt.id::text,
      jsonb_build_object('notes_only', true)
    );

    RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'notes_only', true);
  END IF;

  -- Non-confirmed: allow full edit with conflict check
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

  -- Ensure professional belongs to tenant
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
      'duration_minutes', v_new_duration,
      'professional_profile_id', v_new_professional_id,
      'client_id', p_client_id,
      'service_id', p_service_id,
      'price', v_new_price
    )
  );

  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'notes_only', false);
END;
$$;

REVOKE ALL ON FUNCTION public.update_appointment_v2(uuid, uuid, uuid, uuid, timestamptz, integer, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_appointment_v2(uuid, uuid, uuid, uuid, timestamptz, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_appointment_v2(uuid, uuid, uuid, uuid, timestamptz, integer, numeric, text) TO service_role;


CREATE OR REPLACE FUNCTION public.set_appointment_status_v2(
  p_appointment_id uuid,
  p_status public.appointment_status
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

  IF p_status IS NULL THEN
    RAISE EXCEPTION 'status é obrigatório';
  END IF;

  IF p_status = 'cancelled' THEN
    -- Reuse existing cancel RPC (idempotent + completed protection)
    RETURN public.cancel_appointment(p_appointment_id, NULL);
  END IF;

  IF p_status = 'completed' THEN
    RAISE EXCEPTION 'Use complete_appointment_with_sale para concluir agendamentos';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('set_appointment_status_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para alterar status deste agendamento';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido alterar status de agendamento concluído';
  END IF;

  -- Allowed transitions
  IF p_status = 'confirmed' AND v_apt.status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Transição de status inválida';
  END IF;

  IF p_status = v_apt.status THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true, 'appointment_id', v_apt.id, 'status', v_apt.status);
  END IF;

  UPDATE public.appointments
  SET status = p_status,
      updated_at = now()
  WHERE id = v_apt.id
    AND tenant_id = v_profile.tenant_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_status_changed',
    'appointment',
    v_apt.id::text,
    jsonb_build_object('from', v_apt.status, 'to', p_status)
  );

  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.set_appointment_status_v2(uuid, public.appointment_status) FROM public;
GRANT EXECUTE ON FUNCTION public.set_appointment_status_v2(uuid, public.appointment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_appointment_status_v2(uuid, public.appointment_status) TO service_role;


CREATE OR REPLACE FUNCTION public.delete_appointment_v2(
  p_appointment_id uuid,
  p_reason text DEFAULT NULL
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

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('delete_appointment_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido deletar um agendamento concluído';
  END IF;

  IF NOT v_is_admin THEN
    IF v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
      RAISE EXCEPTION 'Sem permissão para deletar este agendamento';
    END IF;
    IF v_apt.status <> 'pending' THEN
      RAISE EXCEPTION 'Somente agendamentos pendentes podem ser deletados pelo profissional';
    END IF;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_deleted',
    'appointment',
    v_apt.id::text,
    jsonb_build_object(
      'reason', NULLIF(p_reason, ''),
      'snapshot', jsonb_build_object(
        'scheduled_at', v_apt.scheduled_at,
        'duration_minutes', v_apt.duration_minutes,
        'status', v_apt.status,
        'professional_id', v_apt.professional_id,
        'client_id', v_apt.client_id,
        'service_id', v_apt.service_id,
        'price', v_apt.price
      )
    )
  );

  DELETE FROM public.appointments
  WHERE id = v_apt.id
    AND tenant_id = v_profile.tenant_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_appointment_v2(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_appointment_v2(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_appointment_v2(uuid, text) TO service_role;


CREATE OR REPLACE FUNCTION public.create_financial_transaction_v2(
  p_type public.transaction_type,
  p_category text,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_transaction_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_amount numeric;
  v_id uuid;
  v_date date;
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

  IF p_type IS NULL THEN
    RAISE EXCEPTION 'type é obrigatório';
  END IF;

  IF p_category IS NULL OR btrim(p_category) = '' THEN
    RAISE EXCEPTION 'category é obrigatório';
  END IF;

  v_amount := COALESCE(p_amount, 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'amount deve ser maior que zero';
  END IF;

  v_date := COALESCE(p_transaction_date, CURRENT_DATE);

  INSERT INTO public.financial_transactions (
    tenant_id,
    type,
    category,
    amount,
    description,
    transaction_date
  ) VALUES (
    v_profile.tenant_id,
    p_type,
    p_category,
    v_amount,
    NULLIF(p_description, ''),
    v_date
  )
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'financial_transaction_created',
    'financial_transaction',
    v_id::text,
    jsonb_build_object(
      'type', p_type,
      'category', p_category,
      'amount', v_amount,
      'transaction_date', v_date
    )
  );

  RETURN jsonb_build_object('success', true, 'transaction_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_financial_transaction_v2(public.transaction_type, text, numeric, text, date) FROM public;
GRANT EXECUTE ON FUNCTION public.create_financial_transaction_v2(public.transaction_type, text, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_financial_transaction_v2(public.transaction_type, text, numeric, text, date) TO service_role;
