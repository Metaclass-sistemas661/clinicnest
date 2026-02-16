-- P2: Standardize error codes in critical RPCs + centralize product creation (with optional expense) into RPC

-- create_appointment_v2 with machine-readable codes (DETAIL)
CREATE OR REPLACE FUNCTION public.create_appointment_v2(
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
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
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  IF p_scheduled_at IS NULL THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'scheduled_at é obrigatório');
  END IF;

  v_duration := COALESCE(p_duration_minutes, 30);
  IF v_duration <= 0 OR v_duration > 24*60 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'duration_minutes inválido');
  END IF;

  v_price := COALESCE(p_price, 0);
  IF v_price < 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'price não pode ser negativo');
  END IF;

  IF p_status IS NULL THEN
    p_status := 'pending';
  END IF;

  IF p_status NOT IN ('pending','confirmed') THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Status inicial inválido');
  END IF;

  IF v_is_admin THEN
    v_professional_id := COALESCE(p_professional_profile_id, v_profile.id);
  ELSE
    v_professional_id := v_profile.id;
  END IF;

  IF v_professional_id IS NULL THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'professional_id é obrigatório');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Profissional inválido para o tenant');
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
    PERFORM public.raise_app_error('SLOT_CONFLICT', 'Conflito de horário');
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

REVOKE ALL ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamptz, integer, numeric, public.appointment_status, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamptz, integer, numeric, public.appointment_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_v2(uuid, uuid, uuid, timestamptz, integer, numeric, public.appointment_status, text) TO service_role;


-- update_appointment_v2 with codes
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
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('update_appointment_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Sem permissão para editar este agendamento');
  END IF;

  IF v_apt.status = 'completed' THEN
    PERFORM public.raise_app_error('APPOINTMENT_COMPLETED_LOCKED', 'Não é permitido editar um agendamento concluído');
  END IF;

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

  IF v_is_admin THEN
    v_new_professional_id := COALESCE(p_professional_profile_id, v_apt.professional_id);
  ELSE
    v_new_professional_id := v_profile.id;
  END IF;

  v_new_scheduled_at := COALESCE(p_scheduled_at, v_apt.scheduled_at);
  v_new_duration := COALESCE(p_duration_minutes, v_apt.duration_minutes);
  v_new_price := COALESCE(p_price, v_apt.price);

  IF v_new_duration <= 0 OR v_new_duration > 24*60 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'duration_minutes inválido');
  END IF;

  IF v_new_price < 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'price não pode ser negativo');
  END IF;

  IF v_new_professional_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_new_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Profissional inválido para o tenant');
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
    PERFORM public.raise_app_error('SLOT_CONFLICT', 'Conflito de horário');
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


-- delete_appointment_v2 with codes
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
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('delete_appointment_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  END IF;

  IF v_apt.status = 'completed' THEN
    PERFORM public.raise_app_error('APPOINTMENT_DELETE_COMPLETED_FORBIDDEN', 'Não é permitido deletar um agendamento concluído');
  END IF;

  IF NOT v_is_admin THEN
    IF v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
      PERFORM public.raise_app_error('FORBIDDEN', 'Sem permissão para deletar este agendamento');
    END IF;
    IF v_apt.status <> 'pending' THEN
      PERFORM public.raise_app_error('APPOINTMENT_DELETE_PENDING_ONLY', 'Somente agendamentos pendentes podem ser deletados pelo profissional');
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


-- P2.2: product creation as RPC (admin-only) with optional initial expense
CREATE OR REPLACE FUNCTION public.create_product_v2(
  p_name text,
  p_description text DEFAULT NULL,
  p_cost numeric DEFAULT 0,
  p_sale_price numeric DEFAULT 0,
  p_quantity integer DEFAULT 0,
  p_min_quantity integer DEFAULT 5,
  p_category_id uuid DEFAULT NULL,
  p_purchased_with_company_cash boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_product_id uuid;
  v_tx_id uuid;
  v_cost numeric;
  v_qty integer;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode cadastrar produto');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome do produto é obrigatório');
  END IF;

  v_cost := COALESCE(p_cost, 0);
  IF v_cost < 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Custo inválido');
  END IF;

  v_qty := COALESCE(p_quantity, 0);
  IF v_qty < 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Quantidade inválida');
  END IF;

  INSERT INTO public.products (
    tenant_id,
    name,
    description,
    cost,
    sale_price,
    quantity,
    min_quantity,
    category_id
  ) VALUES (
    v_profile.tenant_id,
    p_name,
    NULLIF(p_description, ''),
    v_cost,
    COALESCE(p_sale_price, 0),
    v_qty,
    COALESCE(p_min_quantity, 5),
    p_category_id
  )
  RETURNING id INTO v_product_id;

  IF p_purchased_with_company_cash IS TRUE AND v_qty > 0 AND v_cost > 0 THEN
    INSERT INTO public.financial_transactions (
      tenant_id,
      type,
      category,
      amount,
      description,
      transaction_date,
      product_id
    ) VALUES (
      v_profile.tenant_id,
      'expense',
      'Compra de Produto',
      v_cost * v_qty,
      'Compra de estoque: ' || p_name || ' (' || v_qty || ' un.)',
      current_date,
      v_product_id
    ) RETURNING id INTO v_tx_id;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'product_created',
    'product',
    v_product_id::text,
    jsonb_build_object(
      'quantity', v_qty,
      'cost', v_cost,
      'sale_price', COALESCE(p_sale_price, 0),
      'category_id', p_category_id,
      'purchased_with_company_cash', p_purchased_with_company_cash,
      'financial_transaction_id', CASE WHEN v_tx_id IS NULL THEN NULL ELSE v_tx_id::text END
    )
  );

  RETURN jsonb_build_object('success', true, 'product_id', v_product_id, 'financial_transaction_id', v_tx_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_v2(text, text, numeric, numeric, integer, integer, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.create_product_v2(text, text, numeric, numeric, integer, integer, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_v2(text, text, numeric, numeric, integer, integer, uuid, boolean) TO service_role;
