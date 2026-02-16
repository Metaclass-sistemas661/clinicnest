-- P7: Centralize remaining writes via RPCs (services, clients, goals, templates, categories, product price updates)

-- SERVICES
CREATE OR REPLACE FUNCTION public.upsert_service_v2(
  p_name text,
  p_duration_minutes integer,
  p_price numeric,
  p_description text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_service_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar serviços');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome é obrigatório');
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 5 OR p_duration_minutes > 480 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Duração inválida');
  END IF;

  IF p_price IS NULL OR p_price < 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Preço inválido');
  END IF;

  IF p_service_id IS NULL THEN
    v_action := 'service_created';
    INSERT INTO public.services(tenant_id, name, description, duration_minutes, price, is_active)
    VALUES (v_profile.tenant_id, p_name, NULLIF(p_description,''), p_duration_minutes, p_price, COALESCE(p_is_active,true))
    RETURNING id INTO v_id;
  ELSE
    v_action := 'service_updated';
    UPDATE public.services
    SET name = p_name,
        description = NULLIF(p_description,''),
        duration_minutes = p_duration_minutes,
        price = p_price,
        is_active = COALESCE(p_is_active, is_active),
        updated_at = now()
    WHERE id = p_service_id
      AND tenant_id = v_profile.tenant_id
    RETURNING id INTO v_id;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
    END IF;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    v_action,
    'service',
    v_id::text,
    jsonb_build_object(
      'name', p_name,
      'duration_minutes', p_duration_minutes,
      'price', p_price,
      'is_active', COALESCE(p_is_active,true)
    )
  );

  RETURN jsonb_build_object('success', true, 'service_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_service_v2(text, integer, numeric, text, boolean, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_service_v2(text, integer, numeric, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_service_v2(text, integer, numeric, text, boolean, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_service_active_v2(
  p_service_id uuid,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode alterar status do serviço');
  END IF;

  UPDATE public.services
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_service_id
    AND tenant_id = v_profile.tenant_id
  RETURNING id INTO v_id;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'service_active_changed',
    'service',
    v_id::text,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'service_id', v_id, 'is_active', p_is_active);
END;
$$;

REVOKE ALL ON FUNCTION public.set_service_active_v2(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.set_service_active_v2(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_service_active_v2(uuid, boolean) TO service_role;


-- CLIENTS
CREATE OR REPLACE FUNCTION public.upsert_client_v2(
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome é obrigatório');
  END IF;

  IF p_client_id IS NULL THEN
    v_action := 'client_created';
    INSERT INTO public.clients(tenant_id, name, phone, email, notes)
    VALUES (v_profile.tenant_id, p_name, NULLIF(p_phone,''), NULLIF(p_email,''), NULLIF(p_notes,''))
    RETURNING id INTO v_id;
  ELSE
    v_action := 'client_updated';
    UPDATE public.clients
    SET name = p_name,
        phone = NULLIF(p_phone,''),
        email = NULLIF(p_email,''),
        notes = NULLIF(p_notes,''),
        updated_at = now()
    WHERE id = p_client_id
      AND tenant_id = v_profile.tenant_id
    RETURNING id INTO v_id;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Cliente não encontrado');
    END IF;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    v_action,
    'client',
    v_id::text,
    jsonb_build_object('name', p_name)
  );

  RETURN jsonb_build_object('success', true, 'client_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_client_v2(text, text, text, text, uuid) TO service_role;


-- PRODUCT CATEGORIES
CREATE OR REPLACE FUNCTION public.create_product_category_v2(
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode criar categoria');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Nome é obrigatório');
  END IF;

  INSERT INTO public.product_categories(tenant_id, name)
  VALUES (v_profile.tenant_id, p_name)
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'product_category_created',
    'product_category',
    v_id::text,
    jsonb_build_object('name', p_name)
  );

  RETURN jsonb_build_object('success', true, 'category_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_category_v2(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_product_category_v2(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_category_v2(text) TO service_role;


-- PRODUCTS: price/category update
CREATE OR REPLACE FUNCTION public.update_product_prices_v2(
  p_product_id uuid,
  p_cost numeric,
  p_sale_price numeric,
  p_category_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode editar preços');
  END IF;

  IF p_cost IS NULL OR p_cost < 0 OR p_sale_price IS NULL OR p_sale_price < 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Valores inválidos');
  END IF;

  UPDATE public.products
  SET cost = p_cost,
      sale_price = p_sale_price,
      category_id = p_category_id,
      updated_at = now()
  WHERE id = p_product_id
    AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Produto não encontrado');
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'product_prices_updated',
    'product',
    p_product_id::text,
    jsonb_build_object(
      'cost', p_cost,
      'sale_price', p_sale_price,
      'category_id', p_category_id
    )
  );

  RETURN jsonb_build_object('success', true, 'product_id', p_product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_product_prices_v2(uuid, numeric, numeric, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.update_product_prices_v2(uuid, numeric, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_product_prices_v2(uuid, numeric, numeric, uuid) TO service_role;


-- GOALS (admin-only)
CREATE OR REPLACE FUNCTION public.create_goal_v2(
  p_name text,
  p_goal_type text,
  p_target_value numeric,
  p_period text,
  p_professional_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_show_in_header boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');
  END IF;

  IF p_target_value IS NULL OR p_target_value <= 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inválida');
  END IF;

  INSERT INTO public.goals(
    tenant_id,
    name,
    goal_type,
    target_value,
    period,
    professional_id,
    product_id,
    show_in_header
  ) VALUES (
    v_profile.tenant_id,
    COALESCE(NULLIF(btrim(p_name),''), 'Meta'),
    p_goal_type,
    p_target_value,
    p_period,
    p_professional_id,
    p_product_id,
    COALESCE(p_show_in_header,false)
  ) RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'goal_created',
    'goal',
    v_id::text,
    jsonb_build_object('goal_type', p_goal_type, 'target_value', p_target_value, 'period', p_period)
  );

  RETURN jsonb_build_object('success', true, 'goal_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_goal_v2(text, text, numeric, text, uuid, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.create_goal_v2(text, text, numeric, text, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_goal_v2(text, text, numeric, text, uuid, uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.update_goal_v2(
  p_goal_id uuid,
  p_name text,
  p_target_value numeric,
  p_period text,
  p_professional_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_show_in_header boolean DEFAULT NULL,
  p_header_priority integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');
  END IF;

  IF p_target_value IS NULL OR p_target_value <= 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inválida');
  END IF;

  UPDATE public.goals
  SET name = p_name,
      target_value = p_target_value,
      period = p_period,
      professional_id = p_professional_id,
      product_id = p_product_id,
      show_in_header = COALESCE(p_show_in_header, show_in_header),
      header_priority = COALESCE(p_header_priority, header_priority),
      updated_at = now()
  WHERE id = p_goal_id
    AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Meta não encontrada');
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'goal_updated',
    'goal',
    p_goal_id::text,
    jsonb_build_object('target_value', p_target_value, 'period', p_period)
  );

  RETURN jsonb_build_object('success', true, 'goal_id', p_goal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_goal_v2(uuid, text, numeric, text, uuid, uuid, boolean, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.update_goal_v2(uuid, text, numeric, text, uuid, uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_goal_v2(uuid, text, numeric, text, uuid, uuid, boolean, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.archive_goal_v2(
  p_goal_id uuid,
  p_archived boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_archived_at timestamptz;
  v_priority integer;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');
  END IF;

  IF p_archived THEN
    v_archived_at := now();
    v_priority := 0;
  ELSE
    v_archived_at := NULL;
    v_priority := NULL;
  END IF;

  UPDATE public.goals
  SET archived_at = v_archived_at,
      updated_at = now(),
      show_in_header = CASE WHEN p_archived THEN false ELSE show_in_header END,
      header_priority = CASE WHEN p_archived THEN 0 ELSE header_priority END
  WHERE id = p_goal_id
    AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Meta não encontrada');
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    CASE WHEN p_archived THEN 'goal_archived' ELSE 'goal_unarchived' END,
    'goal',
    p_goal_id::text,
    jsonb_build_object('archived', p_archived)
  );

  RETURN jsonb_build_object('success', true, 'goal_id', p_goal_id, 'archived', p_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_goal_v2(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.archive_goal_v2(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_goal_v2(uuid, boolean) TO service_role;


-- GOAL TEMPLATES (admin-only)
CREATE OR REPLACE FUNCTION public.create_goal_template_v2(
  p_name text,
  p_goal_type text,
  p_target_value numeric,
  p_period text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode salvar template');
  END IF;

  IF p_target_value IS NULL OR p_target_value <= 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inválida');
  END IF;

  INSERT INTO public.goal_templates(tenant_id, name, goal_type, target_value, period)
  VALUES (v_profile.tenant_id, p_name, p_goal_type, p_target_value, p_period)
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'goal_template_created',
    'goal_template',
    v_id::text,
    jsonb_build_object('goal_type', p_goal_type, 'target_value', p_target_value, 'period', p_period)
  );

  RETURN jsonb_build_object('success', true, 'template_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_goal_template_v2(text, text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_goal_template_v2(text, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_goal_template_v2(text, text, numeric, text) TO service_role;
