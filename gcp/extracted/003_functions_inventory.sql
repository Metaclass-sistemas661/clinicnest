-- GCP Migration: Functions - inventory
-- Total: 7 functions


-- ============================================
-- Function: adjust_stock
-- Source: 20260310120000_audit_existing_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_out_reason_type text default null,
  p_reason text default null,
  p_purchased_with_company_cash boolean default false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_product public.products%rowtype;
  v_signed_qty integer;
  v_new_qty integer;
  v_amount numeric;
  v_tx_id uuid;
  v_movement_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  IF p_movement_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'movement_type inválido';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    RAISE EXCEPTION 'Apenas admin pode ajustar estoque';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::text), hashtext('adjust_stock'));

  SELECT * INTO v_product
  FROM public.products pr
  WHERE pr.id = p_product_id
    AND pr.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  v_signed_qty := CASE WHEN p_movement_type = 'in' THEN p_quantity ELSE -p_quantity END;
  v_new_qty := v_product.quantity + v_signed_qty;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  INSERT INTO public.stock_movements (
    tenant_id,
    product_id,
    quantity,
    movement_type,
    out_reason_type,
    reason,
    created_by
  ) VALUES (
    v_profile.tenant_id,
    v_product.id,
    v_signed_qty,
    p_movement_type,
    CASE WHEN p_movement_type = 'out' THEN NULLIF(p_out_reason_type, '') ELSE NULL END,
    p_reason,
    v_profile.id
  ) RETURNING id INTO v_movement_id;

  UPDATE public.products
    SET quantity = v_new_qty,
        updated_at = now()
  WHERE id = v_product.id
    AND tenant_id = v_profile.tenant_id;

  IF p_movement_type = 'in' AND p_purchased_with_company_cash IS TRUE THEN
    v_amount := COALESCE(v_product.cost, 0) * p_quantity;
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
      'Produtos',
      v_amount,
      'Compra de produto (entrada de estoque) - ' || COALESCE(v_product.name, 'Produto'),
      current_date,
      v_product.id
    ) RETURNING id INTO v_tx_id;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'stock_adjusted',
    'product',
    v_product.id::text,
    jsonb_build_object(
      'movement_id', v_movement_id::text,
      'movement_type', p_movement_type,
      'quantity', p_quantity,
      'signed_quantity', v_signed_qty,
      'new_quantity', v_new_qty,
      'out_reason_type', NULLIF(p_out_reason_type, ''),
      'reason', NULLIF(p_reason, ''),
      'purchased_with_company_cash', p_purchased_with_company_cash,
      'financial_transaction_id', CASE WHEN v_tx_id IS NULL THEN NULL ELSE v_tx_id::text END
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product.id,
    'movement_id', v_movement_id,
    'financial_transaction_id', v_tx_id,
    'new_quantity', v_new_qty
  );
END;
$$;


-- ============================================
-- Function: get_dashboard_product_loss_total
-- Source: 20260230000000_add_dashboard_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_product_loss_total(
  p_tenant_id UUID,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_loss NUMERIC := 0;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_current_month INTEGER;
  v_current_year INTEGER;
BEGIN
  -- Se não especificado, usar mês atual
  IF p_year IS NULL OR p_month IS NULL THEN
    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    v_month_start := date_trunc('month', CURRENT_DATE);
    v_month_end := date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 second';
  ELSE
    v_current_month := p_month;
    v_current_year := p_year;
    v_month_start := date_trunc('month', make_date(p_year, p_month, 1));
    v_month_end := date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month' - interval '1 second';
  END IF;

  -- Segurança: chamador deve pertencer ao tenant
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = auth.uid()
  ) THEN
    RETURN 0;
  END IF;

  -- Calcular total de perdas: SUM(ABS(quantity) * cost) para movimentos danificados do mês
  SELECT COALESCE(SUM(ABS(sm.quantity) * COALESCE(p.cost, 0)), 0)
  INTO v_total_loss
  FROM stock_movements sm
  LEFT JOIN products p ON p.id = sm.product_id
  WHERE sm.tenant_id = p_tenant_id
    AND sm.movement_type = 'out'
    AND sm.out_reason_type = 'damaged'
    AND sm.created_at >= v_month_start
    AND sm.created_at <= v_month_end;

  RETURN v_total_loss;
END;
$$;


-- ============================================
-- Function: create_product_v2
-- Source: 20260310131000_rpcs_error_codes_and_product_create.sql
-- ============================================
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


-- ============================================
-- Function: create_product_category_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
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


-- ============================================
-- Function: update_product_prices_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
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


-- ============================================
-- Function: create_purchase_v1
-- Source: 20260312031000_suppliers_crud_and_purchase_cancel_v1.sql
-- ============================================
create or replace function public.create_purchase_v1(
  p_supplier_id uuid default null,
  p_purchased_at timestamptz default null,
  p_invoice_number text default null,
  p_notes text default null,
  p_purchased_with_company_cash boolean default false,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;

  v_purchase_id uuid;
  v_total numeric := 0;

  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_unit_cost numeric;
  v_line_total numeric;
  v_signed_qty integer;
  v_new_qty integer;
  v_new_cost numeric;

  v_movement_id uuid;
  v_tx_id uuid;
  v_description text;
  v_purchased_at timestamptz;
  v_prev_qty integer;
  v_prev_cost numeric;
  v_item_id uuid;
begin
  if v_user_id is null then
    perform public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  end if;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  end if;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);
  if not v_is_admin then
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem registrar compras');
  end if;

  v_purchased_at := coalesce(p_purchased_at, now());

  if p_supplier_id is not null then
    if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.tenant_id = v_profile.tenant_id) then
      perform public.raise_app_error('NOT_FOUND', 'Fornecedor não encontrado');
    end if;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    perform public.raise_app_error('VALIDATION_ERROR', 'items deve ser um array');
  end if;

  insert into public.purchases(
    tenant_id, supplier_id, status, purchased_at, invoice_number, notes, purchased_with_company_cash, total_amount, created_by
  ) values (
    v_profile.tenant_id,
    p_supplier_id,
    'received',
    v_purchased_at,
    nullif(btrim(p_invoice_number), ''),
    nullif(btrim(p_notes), ''),
    coalesce(p_purchased_with_company_cash, false),
    0,
    v_user_id
  ) returning id into v_purchase_id;

  -- Processar itens
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := nullif((v_item->>'quantity')::int, 0);
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, 0);

    if v_qty is null or v_qty <= 0 then
      perform public.raise_app_error('VALIDATION_ERROR', 'Quantidade inválida em item');
    end if;

    if v_unit_cost < 0 then
      perform public.raise_app_error('VALIDATION_ERROR', 'unit_cost inválido em item');
    end if;

    perform pg_advisory_xact_lock(hashtext((v_item->>'product_id')::text), hashtext('purchase_item'));

    select * into v_product
    from public.products pr
    where pr.id = (v_item->>'product_id')::uuid
      and pr.tenant_id = v_profile.tenant_id
    for update;

    if not found then
      perform public.raise_app_error('NOT_FOUND', 'Produto não encontrado em item');
    end if;

    v_prev_qty := v_product.quantity;
    v_prev_cost := v_product.cost;

    v_line_total := round(v_unit_cost * v_qty, 2);
    v_total := v_total + v_line_total;

    -- Custo médio ponderado
    v_signed_qty := v_qty;
    v_new_qty := v_product.quantity + v_signed_qty;

    if v_new_qty <= 0 then
      v_new_cost := v_unit_cost;
    else
      v_new_cost := (coalesce(v_product.cost, 0) * greatest(v_product.quantity, 0) + (v_unit_cost * v_qty)) / v_new_qty;
    end if;

    v_new_cost := round(v_new_cost, 4);

    insert into public.stock_movements(
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) values (
      v_profile.tenant_id,
      v_product.id,
      v_signed_qty,
      'in',
      null,
      'Entrada via compra ' || v_purchase_id::text,
      v_profile.id
    ) returning id into v_movement_id;

    update public.products
      set quantity = v_new_qty,
          cost = v_new_cost,
          updated_at = now()
    where id = v_product.id
      and tenant_id = v_profile.tenant_id;

    insert into public.purchase_items(
      tenant_id, purchase_id, product_id, quantity, unit_cost, line_total, prev_quantity, prev_cost, stock_movement_id
    ) values (
      v_profile.tenant_id, v_purchase_id, v_product.id, v_qty, v_unit_cost, v_line_total, v_prev_qty, v_prev_cost, v_movement_id
    ) returning id into v_item_id;

    perform public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'purchase_item_received',
      'product',
      v_product.id::text,
      jsonb_build_object(
        'purchase_id', v_purchase_id::text,
        'purchase_item_id', v_item_id::text,
        'movement_id', v_movement_id::text,
        'quantity_in', v_qty,
        'unit_cost', v_unit_cost,
        'prev_cost', v_prev_cost,
        'new_cost', v_new_cost,
        'prev_quantity', v_prev_qty,
        'new_quantity', v_new_qty
      )
    );
  end loop;

  update public.purchases
    set total_amount = v_total,
        updated_at = now()
  where id = v_purchase_id
    and tenant_id = v_profile.tenant_id;

  -- Financeiro: registrar despesa total, se marcado
  if coalesce(p_purchased_with_company_cash, false) is true then
    v_description := 'Compra (entrada de estoque)';
    if p_invoice_number is not null and btrim(p_invoice_number) <> '' then
      v_description := v_description || ' · NF ' || btrim(p_invoice_number);
    end if;

    insert into public.financial_transactions(
      tenant_id, type, category, amount, description, transaction_date
    ) values (
      v_profile.tenant_id,
      'expense',
      'Produtos',
      v_total,
      v_description,
      (v_purchased_at at time zone 'UTC')::date
    ) returning id into v_tx_id;

    update public.purchases
      set financial_transaction_id = v_tx_id,
          updated_at = now()
    where id = v_purchase_id
      and tenant_id = v_profile.tenant_id;
  end if;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'purchase_created',
    'purchase',
    v_purchase_id::text,
    jsonb_build_object(
      'supplier_id', case when p_supplier_id is null then null else p_supplier_id::text end,
      'purchased_at', v_purchased_at,
      'invoice_number', nullif(btrim(p_invoice_number), ''),
      'total_amount', v_total,
      'purchased_with_company_cash', coalesce(p_purchased_with_company_cash, false),
      'financial_transaction_id', case when v_tx_id is null then null else v_tx_id::text end
    )
  );

  return jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'total_amount', v_total,
    'financial_transaction_id', v_tx_id
  );
end;
$$;


-- ============================================
-- Function: cancel_purchase_v1
-- Source: 20260312031000_suppliers_crud_and_purchase_cancel_v1.sql
-- ============================================
create or replace function public.cancel_purchase_v1(
  p_purchase_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean;

  v_purchase public.purchases%rowtype;
  v_item public.purchase_items%rowtype;
  v_product public.products%rowtype;

  v_inbound_created_at timestamptz;

  v_conflict boolean;
  v_new_tx_id uuid;
  v_desc text;
  v_out_movement_id uuid;
  v_already_cancelled boolean := false;
begin
  if v_user_id is null then
    perform public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  end if;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  end if;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);
  if not v_is_admin then
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem cancelar compras');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_purchase_id::text), hashtext('cancel_purchase'));

  select * into v_purchase
  from public.purchases pu
  where pu.id = p_purchase_id
    and pu.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Compra não encontrada');
  end if;

  if v_purchase.status = 'cancelled' then
    v_already_cancelled := true;
  end if;

  -- Validar possibilidade de estorno (sem movimentos após a compra)
  for v_item in
    select * from public.purchase_items it
    where it.purchase_id = v_purchase.id
      and it.tenant_id = v_profile.tenant_id
  loop
    if v_item.stock_movement_id is null or v_item.prev_quantity is null then
      perform public.raise_app_error('VALIDATION_ERROR', 'Não é possível cancelar: compra antiga sem snapshot de estoque');
    end if;

    select sm.created_at into v_inbound_created_at
    from public.stock_movements sm
    where sm.id = v_item.stock_movement_id
      and sm.tenant_id = v_profile.tenant_id
    limit 1;

    if v_inbound_created_at is null then
      perform public.raise_app_error('VALIDATION_ERROR', 'Não é possível cancelar: movimentação de entrada não encontrada');
    end if;

    -- Se existir qualquer movimento de estoque para o produto após a entrada desta compra, não estornar
    select exists (
      select 1
      from public.stock_movements sm
      where sm.tenant_id = v_profile.tenant_id
        and sm.product_id = v_item.product_id
        and sm.created_at > v_inbound_created_at
        and sm.id <> v_item.stock_movement_id
    ) into v_conflict;

    if v_conflict then
      perform public.raise_app_error('CONFLICT', 'Não é possível cancelar: houve movimentações de estoque após esta compra');
    end if;
  end loop;

  if v_already_cancelled then
    return jsonb_build_object('success', true, 'already_cancelled', true, 'purchase_id', v_purchase.id);
  end if;

  -- Estornar itens (reverter snapshot e criar movimento out)
  for v_item in
    select * from public.purchase_items it
    where it.purchase_id = v_purchase.id
      and it.tenant_id = v_profile.tenant_id
    order by it.created_at asc
  loop
    perform pg_advisory_xact_lock(hashtext(v_item.product_id::text), hashtext('cancel_purchase_item'));

    select * into v_product
    from public.products pr
    where pr.id = v_item.product_id
      and pr.tenant_id = v_profile.tenant_id
    for update;

    if not found then
      perform public.raise_app_error('NOT_FOUND', 'Produto não encontrado no estorno');
    end if;

    insert into public.stock_movements(
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) values (
      v_profile.tenant_id,
      v_item.product_id,
      -abs(v_item.quantity),
      'out',
      null,
      'Estorno compra ' || v_purchase.id::text,
      v_profile.id
    ) returning id into v_out_movement_id;

    update public.products
      set quantity = v_item.prev_quantity,
          cost = v_item.prev_cost,
          updated_at = now()
    where id = v_item.product_id
      and tenant_id = v_profile.tenant_id;

    perform public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'purchase_item_cancelled',
      'product',
      v_item.product_id::text,
      jsonb_build_object(
        'purchase_id', v_purchase.id::text,
        'purchase_item_id', v_item.id::text,
        'movement_id', v_out_movement_id::text,
        'reverted_to_quantity', v_item.prev_quantity,
        'reverted_to_cost', v_item.prev_cost
      )
    );
  end loop;

  -- Financeiro: estornar a despesa (se existiu) via lançamento income
  if v_purchase.financial_transaction_id is not null then
    v_desc := 'Estorno de compra';
    if v_purchase.invoice_number is not null and btrim(v_purchase.invoice_number) <> '' then
      v_desc := v_desc || ' · NF ' || btrim(v_purchase.invoice_number);
    end if;

    insert into public.financial_transactions(
      tenant_id, type, category, amount, description, transaction_date
    ) values (
      v_profile.tenant_id,
      'income',
      'Produtos',
      v_purchase.total_amount,
      v_desc,
      (now() at time zone 'UTC')::date
    ) returning id into v_new_tx_id;
  end if;

  update public.purchases
    set status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = v_user_id,
        cancel_reason = nullif(btrim(p_reason), ''),
        notes = case
          when p_reason is null or btrim(p_reason) = '' then notes
          else coalesce(notes, '') || '\nCancelamento: ' || p_reason
        end,
        updated_at = now()
  where id = v_purchase.id
    and tenant_id = v_profile.tenant_id;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'purchase_cancelled',
    'purchase',
    v_purchase.id::text,
    jsonb_build_object(
      'reason', nullif(btrim(p_reason), ''),
      'reversal_financial_transaction_id', case when v_new_tx_id is null then null else v_new_tx_id::text end
    )
  );

  return jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase.id,
    'reversal_financial_transaction_id', v_new_tx_id
  );
end;
$$;

