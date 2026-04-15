-- ============================================================
-- GCP Cloud SQL Migration - 003_functions_financial.sql
-- Execution Order: 010
-- Adapted from Supabase PostgreSQL
-- ============================================================
-- IMPORTANT: Run after table creation migrations.
-- auth.uid()  → current_setting('app.current_user_id')::uuid
-- auth.jwt()  → current_setting('app.jwt_claims')::jsonb
-- auth.role() → current_setting('app.user_role')::text
-- These settings must be set per-request by the Cloud Run backend:
--   SET LOCAL app.current_user_id = '<firebase-uid>';
--   SET LOCAL app.jwt_claims = '<jwt-json>';
-- ============================================================

-- GCP Migration: Functions - financial
-- Total: 37 functions


-- ============================================
-- Function: create_expense_on_commission_paid
-- Source: 20260216141000_phase3_commission_paid_rpc.sql
-- ============================================
create or replace function public.create_expense_on_commission_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desc text;
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    v_desc := 'Comissão - ' || coalesce(
      (select full_name from public.profiles where user_id = new.professional_id limit 1),
      'Profissional'
    );

    insert into public.financial_transactions (
      tenant_id,
      appointment_id,
      type,
      category,
      amount,
      description,
      transaction_date,
      commission_payment_id
    ) values (
      new.tenant_id,
      new.appointment_id,
      'expense',
      'Funcionários',
      new.amount,
      v_desc,
      coalesce(new.payment_date, current_date),
      new.id
    )
    on conflict (commission_payment_id) do nothing;
  end if;

  return new;
end;
$$;


-- ============================================
-- Function: create_expense_on_commission_insert
-- Source: 20260203030000_create_expense_on_commission_paid.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_expense_on_commission_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se a comissão já foi criada como "paid", criar despesa imediatamente
    IF NEW.status = 'paid' THEN
        -- Verificar se já existe transação financeira para esta comissão
        IF NOT EXISTS (
            SELECT 1 FROM public.financial_transactions 
            WHERE appointment_id = NEW.appointment_id
            AND description LIKE '%Comissão%'
            AND amount = NEW.amount
        ) THEN
            INSERT INTO public.financial_transactions (
                tenant_id,
                appointment_id,
                type,
                category,
                amount,
                description,
                transaction_date
            ) VALUES (
                NEW.tenant_id,
                NEW.appointment_id,
                'expense',
                'Funcionários',
                NEW.amount,
                'Comissão - ' || COALESCE(
                    (SELECT full_name FROM public.profiles WHERE user_id = NEW.professional_id LIMIT 1),
                    'Profissional'
                ),
                COALESCE(NEW.payment_date, CURRENT_DATE)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_dashboard_commission_totals
-- Source: 20260227000000_fix_salary_not_creating_commissions.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_commission_totals(
  p_tenant_id UUID,
  p_is_admin BOOLEAN,
  p_professional_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
BEGIN
  v_month_start := date_trunc('month', now());
  v_month_end := date_trunc('month', now()) + interval '1 month' - interval '1 second';

  -- Segurança: chamador deve pertencer ao tenant
  IF current_setting('app.current_user_id')::uuid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = current_setting('app.current_user_id')::uuid
  ) THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  -- Staff só pode ver próprias comissões
  IF NOT p_is_admin AND p_professional_user_id IS NOT NULL AND p_professional_user_id != current_setting('app.current_user_id')::uuid THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  IF p_is_admin THEN
    -- Admin: soma de todas as comissões do tenant
    -- FILTRAR: apenas comissões de profissionais com payment_type = 'commission' ou NULL
    SELECT 
      COALESCE(SUM(CASE WHEN cp.status::text = 'pending' THEN cp.amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN cp.status::text = 'paid' THEN cp.amount ELSE 0 END), 0)
    INTO v_pending, v_paid
    FROM commission_payments cp
    LEFT JOIN professional_commissions pc ON pc.id = cp.commission_config_id
    WHERE cp.tenant_id = p_tenant_id
      AND cp.created_at >= v_month_start
      AND cp.created_at <= v_month_end
      AND (pc.payment_type IS NULL OR pc.payment_type = 'commission');  -- Excluir salários
  ELSE
    -- Staff: apenas suas comissões
    IF p_professional_user_id IS NOT NULL THEN
      SELECT 
        COALESCE(SUM(CASE WHEN cp.status::text = 'pending' THEN cp.amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN cp.status::text = 'paid' THEN cp.amount ELSE 0 END), 0)
      INTO v_pending, v_paid
      FROM commission_payments cp
      LEFT JOIN professional_commissions pc ON pc.id = cp.commission_config_id
      WHERE cp.tenant_id = p_tenant_id
        AND cp.professional_id = p_professional_user_id
        AND cp.created_at >= v_month_start
        AND cp.created_at <= v_month_end
        AND (pc.payment_type IS NULL OR pc.payment_type = 'commission');  -- Excluir salários
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pending', (v_pending)::float,
    'paid', (v_paid)::float
  );
END;
$$;


-- ============================================
-- Function: claim_asaas_webhook_event
-- Source: 20260216120000_hardening_webhook_idempotency.sql
-- ============================================
create or replace function public.claim_asaas_webhook_event(
  p_event_key text,
  p_event_type text,
  p_payload jsonb
)
returns table(
  status text,
  attempts integer,
  already_processed boolean,
  claimed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  insert into public.asaas_webhook_events (event_key, event_type, status, attempts, payload)
  values (p_event_key, p_event_type, 'received', 1, p_payload)
  on conflict (event_key) do update
    set attempts = public.asaas_webhook_events.attempts + 1,
        event_type = coalesce(public.asaas_webhook_events.event_type, excluded.event_type),
        payload = coalesce(public.asaas_webhook_events.payload, excluded.payload);

  if exists (
    select 1
    from public.asaas_webhook_events e
    where e.event_key = p_event_key
      and e.status = 'processed'
  ) then
    return query
    select
      e.status,
      e.attempts,
      true as already_processed,
      false as claimed
    from public.asaas_webhook_events e
    where e.event_key = p_event_key;
    return;
  end if;

  v_locked := pg_try_advisory_xact_lock(hashtext(p_event_key), hashtext('asaas_webhook'));

  if not v_locked then
    return query
    select
      e.status,
      e.attempts,
      (e.status = 'processed') as already_processed,
      false as claimed
    from public.asaas_webhook_events e
    where e.event_key = p_event_key;
    return;
  end if;

  update public.asaas_webhook_events
    set status = 'processing'
  where event_key = p_event_key
    and status <> 'processed';

  return query
  select
    e.status,
    e.attempts,
    (e.status = 'processed') as already_processed,
    (e.status = 'processing') as claimed
  from public.asaas_webhook_events e
  where e.event_key = p_event_key;
end;
$$;


-- ============================================
-- Function: mark_commission_paid
-- Source: 20260310120000_audit_existing_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_commission_paid(
  p_commission_payment_id uuid,
  p_payment_date date default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
  v_row public.commission_payments%rowtype;
  v_paid boolean;
  v_payment_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_payment_date := COALESCE(p_payment_date, current_date);

  PERFORM pg_advisory_xact_lock(hashtext(p_commission_payment_id::text), hashtext('mark_commission_paid'));

  SELECT * INTO v_row
  FROM public.commission_payments cp
  WHERE cp.id = p_commission_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comissão não encontrada';
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_row.tenant_id) THEN
    RAISE EXCEPTION 'Apenas admin pode pagar comissão';
  END IF;

  v_paid := (v_row.status = 'paid');
  IF v_paid THEN
    PERFORM public.log_tenant_action(
      v_row.tenant_id,
      v_user_id,
      'commission_marked_paid',
      'commission_payment',
      v_row.id::text,
      jsonb_build_object('already_paid', true)
    );

    RETURN jsonb_build_object('success', true, 'already_paid', true, 'commission_payment_id', v_row.id);
  END IF;

  IF v_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'Comissão cancelada não pode ser paga';
  END IF;

  UPDATE public.commission_payments
    SET status = 'paid',
        payment_date = v_payment_date,
        paid_by = v_user_id,
        updated_at = now()
  WHERE id = v_row.id;

  PERFORM public.log_tenant_action(
    v_row.tenant_id,
    v_user_id,
    'commission_marked_paid',
    'commission_payment',
    v_row.id::text,
    jsonb_build_object('already_paid', false, 'payment_date', v_payment_date)
  );

  RETURN jsonb_build_object('success', true, 'already_paid', false, 'commission_payment_id', v_row.id);
END;
$$;


-- ============================================
-- Function: seed_payment_methods_for_tenant
-- Source: 20260218200000_orders_checkout_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.seed_payment_methods_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_methods (tenant_id, code, name, sort_order) VALUES
    (NEW.id, 'cash',     'Dinheiro',       1),
    (NEW.id, 'pix',      'PIX',            2),
    (NEW.id, 'card',     'Cartão',         3),
    (NEW.id, 'transfer', 'Transferência',  4)
  ON CONFLICT (tenant_id, code) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: create_walkin_order_v1
-- Source: 20260218200000_orders_checkout_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_walkin_order_v1(
  p_client_id         uuid DEFAULT NULL,
  p_professional_id   uuid DEFAULT NULL,  -- profiles.id
  p_notes             text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := current_setting('app.current_user_id')::uuid;
  v_profile     public.profiles%rowtype;
  v_is_admin    boolean;
  v_prof_id     uuid;
  v_apt_id      uuid;
  v_order_id    uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
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
    RAISE EXCEPTION 'Profissional inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Create walk-in appointment (no conflict check needed — walk-in has no slot)
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
$$;


-- ============================================
-- Function: add_order_item_v1
-- Source: 20260218200000_orders_checkout_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.add_order_item_v1(
  p_order_id        uuid,
  p_kind            text,          -- 'service' | 'product'
  p_service_id      uuid DEFAULT NULL,
  p_product_id      uuid DEFAULT NULL,
  p_quantity        integer DEFAULT 1,
  p_unit_price      numeric DEFAULT NULL,
  p_professional_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := current_setting('app.current_user_id')::uuid;
  v_profile     public.profiles%rowtype;
  v_order       public.orders%rowtype;
  v_price       numeric;
  v_total       numeric;
  v_item_id     uuid;
  v_new_subtotal numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada' USING DETAIL = 'NOT_FOUND'; END IF;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda não permite alterações (status: %)', v_order.status USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_kind NOT IN ('service', 'product') THEN
    RAISE EXCEPTION 'Tipo de item inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Resolve price
  IF p_kind = 'service' THEN
    IF p_service_id IS NULL THEN
      RAISE EXCEPTION 'service_id obrigatório para item tipo serviço' USING DETAIL = 'VALIDATION_ERROR';
    END IF;
    IF p_unit_price IS NOT NULL THEN
      v_price := p_unit_price;
    ELSE
      SELECT price INTO v_price FROM public.services WHERE id = p_service_id AND tenant_id = v_profile.tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado' USING DETAIL = 'NOT_FOUND'; END IF;
    END IF;
  ELSE -- product
    IF p_product_id IS NULL THEN
      RAISE EXCEPTION 'product_id obrigatório para item tipo produto' USING DETAIL = 'VALIDATION_ERROR';
    END IF;
    IF p_unit_price IS NOT NULL THEN
      v_price := p_unit_price;
    ELSE
      SELECT sale_price INTO v_price FROM public.products WHERE id = p_product_id AND tenant_id = v_profile.tenant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado' USING DETAIL = 'NOT_FOUND'; END IF;
    END IF;
  END IF;

  v_total := v_price * p_quantity;

  INSERT INTO public.order_items (
    tenant_id, order_id, kind, service_id, product_id, professional_id,
    quantity, unit_price, total_price
  ) VALUES (
    v_profile.tenant_id, p_order_id, p_kind::public.order_item_kind,
    p_service_id, p_product_id, p_professional_id,
    p_quantity, v_price, v_total
  )
  RETURNING id INTO v_item_id;

  -- Recalculate subtotal
  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal
  FROM public.order_items WHERE order_id = p_order_id;

  UPDATE public.orders
  SET subtotal_amount = v_new_subtotal,
      total_amount = GREATEST(v_new_subtotal - discount_amount, 0),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'item_id', v_item_id, 'subtotal', v_new_subtotal);
END;
$$;


-- ============================================
-- Function: remove_order_item_v1
-- Source: 20260218200000_orders_checkout_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.remove_order_item_v1(
  p_order_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := current_setting('app.current_user_id')::uuid;
  v_profile      public.profiles%rowtype;
  v_item         public.order_items%rowtype;
  v_order        public.orders%rowtype;
  v_new_subtotal numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_item FROM public.order_items
  WHERE id = p_order_item_id AND tenant_id = v_profile.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado' USING DETAIL = 'NOT_FOUND'; END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = v_item.order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda não permite alterações' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  DELETE FROM public.order_items WHERE id = p_order_item_id;

  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal
  FROM public.order_items WHERE order_id = v_order.id;

  UPDATE public.orders
  SET subtotal_amount = v_new_subtotal,
      discount_amount = LEAST(discount_amount, v_new_subtotal),
      total_amount = GREATEST(v_new_subtotal - LEAST(discount_amount, v_new_subtotal), 0),
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object('success', true, 'subtotal', v_new_subtotal);
END;
$$;


-- ============================================
-- Function: set_order_discount_v1
-- Source: 20260218200000_orders_checkout_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_order_discount_v1(
  p_order_id        uuid,
  p_discount_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := current_setting('app.current_user_id')::uuid;
  v_profile  public.profiles%rowtype;
  v_order    public.orders%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada' USING DETAIL = 'NOT_FOUND'; END IF;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda não permite alterações' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_discount_amount < 0 THEN
    RAISE EXCEPTION 'Desconto não pode ser negativo' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_discount_amount > v_order.subtotal_amount THEN
    RAISE EXCEPTION 'Desconto não pode ser maior que o subtotal' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  UPDATE public.orders
  SET discount_amount = p_discount_amount,
      total_amount = GREATEST(subtotal_amount - p_discount_amount, 0),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_amount', GREATEST(v_order.subtotal_amount - p_discount_amount, 0)
  );
END;
$$;


-- ============================================
-- Function: finalize_order_v1
-- Source: 20260312042000_orders_paid_at_bi_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.finalize_order_v1(
  p_order_id  uuid,
  p_payments  jsonb  -- [{payment_method_id, amount}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := current_setting('app.current_user_id')::uuid;
  v_profile       public.profiles%rowtype;
  v_order         public.orders%rowtype;
  v_pay           jsonb;
  v_pay_total     numeric := 0;
  v_pm_id         uuid;
  v_pm_amount     numeric;
  v_item          record;
  v_product       public.products%rowtype;
  v_new_qty       integer;
  v_tx_date       date;

  v_unit_cost     numeric;
  v_total_cost    numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;

  -- Lock order
  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada' USING DETAIL = 'NOT_FOUND'; END IF;

  IF v_order.status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Comanda já finalizada ou cancelada (status: %)', v_order.status USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_order.total_amount <= 0 THEN
    RAISE EXCEPTION 'Comanda sem valor para pagamento' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Validate payments array
  IF p_payments IS NULL OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Nenhum pagamento informado' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Calculate total of payments
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_pm_id := (v_pay->>'payment_method_id')::uuid;
    v_pm_amount := (v_pay->>'amount')::numeric;

    IF v_pm_id IS NULL OR v_pm_amount IS NULL OR v_pm_amount <= 0 THEN
      RAISE EXCEPTION 'Pagamento inválido' USING DETAIL = 'VALIDATION_ERROR';
    END IF;

    -- Validate payment method belongs to tenant
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_methods
      WHERE id = v_pm_id AND tenant_id = v_profile.tenant_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Método de pagamento inválido' USING DETAIL = 'VALIDATION_ERROR';
    END IF;

    v_pay_total := v_pay_total + v_pm_amount;
  END LOOP;

  -- Validate split = total (allow 0.01 tolerance for rounding)
  IF abs(v_pay_total - v_order.total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos pagamentos (%) difere do total da comanda (%)',
      v_pay_total, v_order.total_amount
    USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- ─── STOCK VALIDATION (pre-check all products before any mutation) ───
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.name AS product_name, p.quantity AS stock_qty
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.kind = 'product'
  LOOP
    IF v_item.stock_qty < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, necessário %',
        v_item.product_name, v_item.stock_qty, v_item.quantity
      USING DETAIL = 'STOCK_INSUFFICIENT';
    END IF;
  END LOOP;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  -- ─── CREATE PAYMENTS ───
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO public.payments (
      tenant_id, order_id, payment_method_id, amount, status, paid_at
    ) VALUES (
      v_profile.tenant_id, p_order_id,
      (v_pay->>'payment_method_id')::uuid,
      (v_pay->>'amount')::numeric,
      'paid', now()
    );
  END LOOP;

  -- ─── STOCK MOVEMENTS (out, sale) for product items + CMV snapshot ───
  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.kind = 'product'
  LOOP
    -- Lock product
    SELECT * INTO v_product FROM public.products
    WHERE id = v_item.product_id AND tenant_id = v_profile.tenant_id
    FOR UPDATE;

    v_new_qty := v_product.quantity - v_item.quantity;

    -- Double-check (race condition guard)
    IF v_new_qty < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%"', v_product.name USING DETAIL = 'STOCK_INSUFFICIENT';
    END IF;

    -- Snapshot de custo médio no momento da venda
    v_unit_cost := round(coalesce(v_product.cost, 0), 4);
    v_total_cost := round(v_unit_cost * v_item.quantity, 4);

    UPDATE public.order_items
      SET unit_cost_snapshot = v_unit_cost,
          total_cost_snapshot = v_total_cost
    WHERE id = v_item.id
      AND tenant_id = v_profile.tenant_id
      AND order_id = p_order_id;

    UPDATE public.products SET quantity = v_new_qty, updated_at = now()
    WHERE id = v_item.product_id;

    INSERT INTO public.stock_movements (
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) VALUES (
      v_profile.tenant_id, v_item.product_id,
      -v_item.quantity, 'out', 'sale',
      'Venda via comanda #' || left(p_order_id::text, 8),
      v_user_id::text
    );
  END LOOP;

  -- ─── FINANCIAL TRANSACTIONS (income) ───
  -- One transaction for services total
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND kind = 'service') THEN
    INSERT INTO public.financial_transactions (
      tenant_id, appointment_id, type, category, amount, description, transaction_date
    ) VALUES (
      v_profile.tenant_id, v_order.appointment_id,
      'income', 'Serviço',
      (SELECT COALESCE(SUM(total_price), 0) FROM public.order_items WHERE order_id = p_order_id AND kind = 'service'),
      'Comanda #' || left(p_order_id::text, 8) || ' — serviços',
      v_tx_date
    );
  END IF;

  -- One transaction for products total
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND kind = 'product') THEN
    INSERT INTO public.financial_transactions (
      tenant_id, appointment_id, type, category, amount, description, transaction_date
    ) VALUES (
      v_profile.tenant_id, v_order.appointment_id,
      'income', 'Venda de Produto',
      (SELECT COALESCE(SUM(total_price), 0) FROM public.order_items WHERE order_id = p_order_id AND kind = 'product'),
      'Comanda #' || left(p_order_id::text, 8) || ' — produtos',
      v_tx_date
    );
  END IF;

  -- Discount as expense if > 0
  IF v_order.discount_amount > 0 THEN
    INSERT INTO public.financial_transactions (
      tenant_id, appointment_id, type, category, amount, description, transaction_date
    ) VALUES (
      v_profile.tenant_id, v_order.appointment_id,
      'expense', 'Desconto',
      v_order.discount_amount,
      'Desconto comanda #' || left(p_order_id::text, 8),
      v_tx_date
    );
  END IF;

  -- ─── UPDATE ORDER STATUS ───
  UPDATE public.orders
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  -- ─── UPDATE APPOINTMENT STATUS to completed ───
  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = v_order.appointment_id
    AND status <> 'completed';

  -- Audit
  PERFORM public.log_tenant_action(
    v_profile.tenant_id, v_user_id,
    'order_finalized', 'order', p_order_id::text,
    jsonb_build_object(
      'total', v_order.total_amount,
      'payments_count', jsonb_array_length(p_payments),
      'appointment_id', v_order.appointment_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'paid'
  );
END;
$$;


-- ============================================
-- Function: open_cash_session_v1
-- Source: 20260218220000_cash_register_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.open_cash_session_v1(
  p_opening_balance numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := current_setting('app.current_user_id')::uuid;
  v_profile   public.profiles%rowtype;
  v_session_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  IF p_opening_balance < 0 THEN
    RAISE EXCEPTION 'Saldo inicial inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE tenant_id = v_profile.tenant_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Já existe um caixa aberto' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.cash_sessions (
    tenant_id, status,
    opened_at, opened_by,
    opening_balance, opening_notes
  ) VALUES (
    v_profile.tenant_id, 'open',
    now(), v_user_id,
    COALESCE(p_opening_balance, 0), p_notes
  )
  RETURNING id INTO v_session_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'cash_session_opened',
    'cash_session',
    v_session_id::text,
    jsonb_build_object('opening_balance', COALESCE(p_opening_balance, 0))
  );

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;


-- ============================================
-- Function: add_cash_movement_v1
-- Source: 20260218220000_cash_register_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.add_cash_movement_v1(
  p_type text,
  p_amount numeric,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
  v_profile public.profiles%rowtype;
  v_session public.cash_sessions%rowtype;
  v_movement_id uuid;
  v_type public.cash_movement_type;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_type NOT IN ('reinforcement','withdrawal') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  v_type := p_type::public.cash_movement_type;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE tenant_id = v_profile.tenant_id AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há caixa aberto' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.cash_movements (
    tenant_id, session_id, type, amount, reason, created_by
  ) VALUES (
    v_profile.tenant_id, v_session.id, v_type, p_amount, p_reason, v_user_id
  )
  RETURNING id INTO v_movement_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'cash_movement_created',
    'cash_movement',
    v_movement_id::text,
    jsonb_build_object('session_id', v_session.id, 'type', p_type, 'amount', p_amount)
  );

  RETURN jsonb_build_object('success', true, 'movement_id', v_movement_id, 'session_id', v_session.id);
END;
$$;


-- ============================================
-- Function: get_cash_session_summary_v1
-- Source: 20260312053000_cash_summary_paid_at_fallback_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_cash_session_summary_v1(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
  v_profile public.profiles%rowtype;
  v_session public.cash_sessions%rowtype;
  v_payments jsonb;
  v_withdrawals numeric := 0;
  v_reinforcements numeric := 0;
  v_total numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals
  FROM public.cash_movements
  WHERE session_id = v_session.id AND type = 'withdrawal';

  SELECT COALESCE(SUM(amount), 0) INTO v_reinforcements
  FROM public.cash_movements
  WHERE session_id = v_session.id AND type = 'reinforcement';

  -- Summary by payment method for payments in the session window
  -- Fallback importante: se paid_at for nulo (legado), usar created_at.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'payment_method_id', pm.id,
        'code', pm.code,
        'name', pm.name,
        'amount', x.amount
      )
      ORDER BY pm.sort_order
    ),
    '[]'::jsonb
  ) INTO v_payments
  FROM (
    SELECT p.payment_method_id, SUM(p.amount)::numeric AS amount
    FROM public.payments p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.tenant_id = v_session.tenant_id
      AND p.status = 'paid'
      AND COALESCE(p.paid_at, p.created_at) >= v_session.opened_at
      AND COALESCE(p.paid_at, p.created_at) <= COALESCE(v_session.closed_at, now())
    GROUP BY p.payment_method_id
  ) x
  JOIN public.payment_methods pm ON pm.id = x.payment_method_id;

  -- Expected total (cashbox perspective): opening + reinforcements - withdrawals + sum(payments)
  SELECT COALESCE(SUM((elem->>'amount')::numeric), 0) INTO v_total
  FROM jsonb_array_elements(v_payments) elem;

  v_total := COALESCE(v_session.opening_balance, 0) + v_reinforcements - v_withdrawals + v_total;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', v_session.status,
    'opened_at', v_session.opened_at,
    'closed_at', v_session.closed_at,
    'opening_balance', v_session.opening_balance,
    'reinforcements', v_reinforcements,
    'withdrawals', v_withdrawals,
    'payments', v_payments,
    'expected_closing_balance', v_total
  );
END;
$$;


-- ============================================
-- Function: close_cash_session_v1
-- Source: 20260218220000_cash_register_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.close_cash_session_v1(
  p_session_id uuid,
  p_reported_balance numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
  v_profile public.profiles%rowtype;
  v_session public.cash_sessions%rowtype;
  v_summary jsonb;
  v_expected numeric;
  v_diff numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id AND tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Caixa já está fechado' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_reported_balance IS NULL OR p_reported_balance < 0 THEN
    RAISE EXCEPTION 'Saldo informado inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Close window first for consistent summary
  UPDATE public.cash_sessions
  SET closed_at = now(), closed_by = v_user_id, updated_at = now()
  WHERE id = v_session.id;

  -- Recalculate session after setting closed_at
  SELECT public.get_cash_session_summary_v1(v_session.id) INTO v_summary;
  v_expected := COALESCE((v_summary->>'expected_closing_balance')::numeric, 0);
  v_diff := p_reported_balance - v_expected;

  UPDATE public.cash_sessions
  SET status = 'closed',
      closing_balance_reported = p_reported_balance,
      closing_balance_expected = v_expected,
      closing_difference = v_diff,
      closing_notes = p_notes,
      updated_at = now()
  WHERE id = v_session.id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'cash_session_closed',
    'cash_session',
    v_session.id::text,
    jsonb_build_object(
      'expected', v_expected,
      'reported', p_reported_balance,
      'difference', v_diff
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'status', 'closed',
    'expected', v_expected,
    'reported', p_reported_balance,
    'difference', v_diff
  );
END;
$$;


-- ============================================
-- Function: apply_coupon_to_order_v1
-- Source: 20260219200000_phase3_vendas_fidelidade.sql
-- ============================================
CREATE OR REPLACE FUNCTION apply_coupon_to_order_v1(
  p_code     text,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_coupon    discount_coupons%ROWTYPE;
  v_order     orders%ROWTYPE;
  v_discount  numeric;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','unauthenticated');
  END IF;

  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','order_not_found');
  END IF;
  IF v_order.status NOT IN ('draft','open') THEN
    RETURN jsonb_build_object('success',false,'error','order_not_editable');
  END IF;
  IF v_order.applied_coupon_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',false,'error','coupon_already_applied');
  END IF;

  -- Validate coupon
  SELECT * INTO v_coupon FROM discount_coupons
  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','not_found');
  END IF;
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('success',false,'error','inactive');
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > CURRENT_DATE THEN
    RETURN jsonb_build_object('success',false,'error','not_yet_valid');
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < CURRENT_DATE THEN
    RETURN jsonb_build_object('success',false,'error','expired');
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('success',false,'error','max_uses_reached');
  END IF;

  -- Calculate discount
  IF v_coupon.type = 'percent' THEN
    v_discount := ROUND(v_order.subtotal_amount * v_coupon.value / 100, 2);
  ELSE
    v_discount := v_coupon.value;
  END IF;
  v_discount := LEAST(v_order.subtotal_amount, v_discount);

  -- Apply discount + increment used_count
  UPDATE orders
  SET discount_amount  = LEAST(subtotal_amount, discount_amount + v_discount),
      total_amount     = GREATEST(0, total_amount - v_discount),
      applied_coupon_id = v_coupon.id
  WHERE id = p_order_id;

  UPDATE discount_coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;

  RETURN jsonb_build_object(
    'success',          true,
    'coupon_id',        v_coupon.id,
    'discount_applied', v_discount
  );
END;
$$;


-- ============================================
-- Function: earn_points_for_order_v1
-- Source: 20260219200000_phase3_vendas_fidelidade.sql
-- ============================================
CREATE OR REPLACE FUNCTION earn_points_for_order_v1(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_order       orders%ROWTYPE;
  v_ppr         numeric;
  v_enabled     boolean;
  v_pts         integer;
  v_wallet_id   uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE id = current_setting('app.current_user_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','unauthenticated');
  END IF;

  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','order_not_found');
  END IF;
  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('success',false,'error','order_not_paid');
  END IF;
  IF v_order.client_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'skipped','no_client');
  END IF;

  SELECT points_enabled, points_per_real INTO v_enabled, v_ppr
  FROM tenants WHERE id = v_tenant_id;
  IF NOT v_enabled OR v_ppr IS NULL OR v_ppr <= 0 THEN
    RETURN jsonb_build_object('success',false,'skipped','points_disabled');
  END IF;

  v_pts := FLOOR(v_order.total_amount * v_ppr)::integer;
  IF v_pts <= 0 THEN
    RETURN jsonb_build_object('success',true,'points_earned',0);
  END IF;

  -- Upsert wallet
  INSERT INTO points_wallets(tenant_id, client_id, balance)
  VALUES (v_tenant_id, v_order.client_id, 0)
  ON CONFLICT (tenant_id, client_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM points_wallets
  WHERE tenant_id = v_tenant_id AND client_id = v_order.client_id;

  -- Idempotency: check if already earned for this order
  IF EXISTS (
    SELECT 1 FROM points_ledger
    WHERE wallet_id = v_wallet_id AND reason = 'earn' AND ref_id = p_order_id
  ) THEN
    RETURN jsonb_build_object('success',true,'skipped','already_earned');
  END IF;

  UPDATE points_wallets
  SET balance = balance + v_pts, updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO points_ledger(wallet_id, tenant_id, client_id, delta, reason, ref_id)
  VALUES (v_wallet_id, v_tenant_id, v_order.client_id, v_pts, 'earn', p_order_id);

  RETURN jsonb_build_object('success',true,'points_earned',v_pts);
END;
$$;


-- ============================================
-- Function: pay_salary
-- Source: 20260303000000_lgpd_hardening_rpcs_and_consent.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.pay_salary(
  p_professional_id UUID,
  p_payment_month INTEGER,
  p_payment_year INTEGER,
  p_payment_method TEXT,
  p_days_worked INTEGER DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;
  v_requester_tenant_id UUID;
  v_requester_is_admin BOOLEAN := FALSE;
  v_tenant_id UUID;
  v_commission_config RECORD;
  v_days_in_month INTEGER;
  v_calculated_amount NUMERIC;
  v_salary_payment_id UUID;
  v_financial_transaction_id UUID;
  v_professional_name TEXT;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT p.tenant_id
  INTO v_requester_tenant_id
  FROM public.profiles p
  WHERE p.user_id = v_requester_user_id
  LIMIT 1;

  IF v_requester_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado';
  END IF;

  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, v_requester_tenant_id);
  IF NOT v_requester_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar pagamento de salário';
  END IF;

  IF p_payment_month < 1 OR p_payment_month > 12 THEN
    RAISE EXCEPTION 'Mês de pagamento inválido';
  END IF;

  IF p_payment_year < 2020 THEN
    RAISE EXCEPTION 'Ano de pagamento inválido';
  END IF;

  IF p_days_worked IS NOT NULL AND p_days_worked < 0 THEN
    RAISE EXCEPTION 'Dias trabalhados não pode ser negativo';
  END IF;

  IF p_payment_method NOT IN ('pix', 'deposit', 'cash', 'other') THEN
    RAISE EXCEPTION 'Método de pagamento inválido';
  END IF;

  SELECT p.tenant_id, p.full_name
  INTO v_tenant_id, v_professional_name
  FROM public.profiles p
  WHERE p.user_id = p_professional_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado';
  END IF;

  IF v_tenant_id <> v_requester_tenant_id THEN
    RAISE EXCEPTION 'Sem permissão para registrar salário fora do seu tenant';
  END IF;

  SELECT *
  INTO v_commission_config
  FROM public.professional_commissions
  WHERE user_id = p_professional_id
    AND tenant_id = v_tenant_id
    AND payment_type = 'salary'
  LIMIT 1;

  IF v_commission_config IS NULL THEN
    RAISE EXCEPTION 'Profissional não possui salário fixo configurado';
  END IF;

  IF v_commission_config.salary_amount IS NULL OR v_commission_config.salary_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do salário não configurado ou inválido';
  END IF;

  v_days_in_month := EXTRACT(
    DAY FROM (
      DATE_TRUNC('month', TO_DATE(p_payment_year || '-' || LPAD(p_payment_month::TEXT, 2, '0') || '-01', 'YYYY-MM-DD'))
      + INTERVAL '1 month'
      - INTERVAL '1 day'
    )
  );

  IF p_days_worked IS NOT NULL AND p_days_worked > 0 THEN
    IF p_days_worked > v_days_in_month THEN
      RAISE EXCEPTION 'Dias trabalhados não pode ser maior que os dias do mês (%)', v_days_in_month;
    END IF;
    v_calculated_amount := (v_commission_config.salary_amount / v_days_in_month) * p_days_worked;
  ELSE
    v_calculated_amount := v_commission_config.salary_amount;
    p_days_worked := v_days_in_month;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.salary_payments
    WHERE tenant_id = v_tenant_id
      AND professional_id = p_professional_id
      AND payment_month = p_payment_month
      AND payment_year = p_payment_year
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Salário já foi pago para este período';
  END IF;

  INSERT INTO public.salary_payments (
    tenant_id,
    professional_id,
    professional_commission_id,
    payment_month,
    payment_year,
    amount,
    days_worked,
    days_in_month,
    status,
    payment_date,
    payment_method,
    payment_reference,
    paid_by,
    notes
  ) VALUES (
    v_tenant_id,
    p_professional_id,
    v_commission_config.id,
    p_payment_month,
    p_payment_year,
    v_calculated_amount,
    p_days_worked,
    v_days_in_month,
    'paid',
    CURRENT_DATE,
    p_payment_method,
    p_payment_reference,
    v_requester_user_id,
    p_notes
  )
  RETURNING id INTO v_salary_payment_id;

  INSERT INTO public.financial_transactions (
    tenant_id,
    type,
    category,
    amount,
    description,
    transaction_date,
    salary_payment_id
  ) VALUES (
    v_tenant_id,
    'expense',
    'Funcionários',
    v_calculated_amount,
    'Salário - ' || COALESCE(v_professional_name, 'Profissional') ||
    ' - ' || TO_CHAR(TO_DATE(p_payment_year || '-' || LPAD(p_payment_month::TEXT, 2, '0') || '-01', 'YYYY-MM-DD'), 'MM/YYYY') ||
    CASE
      WHEN p_days_worked IS NOT NULL AND p_days_worked < v_days_in_month
      THEN ' (' || p_days_worked || '/' || v_days_in_month || ' dias)'
      ELSE ''
    END,
    CURRENT_DATE,
    v_salary_payment_id
  )
  RETURNING id INTO v_financial_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'salary_payment_id', v_salary_payment_id,
    'financial_transaction_id', v_financial_transaction_id,
    'amount', v_calculated_amount,
    'professional_name', v_professional_name,
    'days_worked', p_days_worked,
    'days_in_month', v_days_in_month
  );
END;
$$;


-- ============================================
-- Function: get_salary_payments
-- Source: 20260303000000_lgpd_hardening_rpcs_and_consent.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_salary_payments(
  p_tenant_id UUID,
  p_professional_id UUID DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_month INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;
  v_requester_is_admin BOOLEAN := FALSE;
  v_effective_professional_id UUID;
  v_result JSONB;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = v_requester_user_id
      AND p.tenant_id = p_tenant_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, p_tenant_id);

  IF v_requester_is_admin THEN
    v_effective_professional_id := p_professional_id;
  ELSE
    IF p_professional_id IS NOT NULL AND p_professional_id <> v_requester_user_id THEN
      RETURN '[]'::jsonb;
    END IF;
    v_effective_professional_id := v_requester_user_id;
  END IF;

  WITH ordered_salaries AS (
    SELECT
      sp.id,
      sp.professional_id,
      COALESCE(p.full_name, 'Profissional') AS professional_name,
      sp.payment_month,
      sp.payment_year,
      sp.amount,
      sp.days_worked,
      sp.days_in_month,
      sp.status,
      sp.payment_date,
      sp.payment_method,
      sp.payment_reference,
      sp.notes,
      sp.created_at,
      sp.updated_at
    FROM public.salary_payments sp
    LEFT JOIN public.profiles p ON p.user_id = sp.professional_id
    WHERE sp.tenant_id = p_tenant_id
      AND (v_effective_professional_id IS NULL OR sp.professional_id = v_effective_professional_id)
      AND (p_year IS NULL OR sp.payment_year = p_year)
      AND (p_month IS NULL OR sp.payment_month = p_month)
    ORDER BY sp.payment_year DESC, sp.payment_month DESC, sp.created_at DESC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'professional_id', professional_id,
      'professional_name', professional_name,
      'payment_month', payment_month,
      'payment_year', payment_year,
      'amount', amount,
      'days_worked', days_worked,
      'days_in_month', days_in_month,
      'status', status,
      'payment_date', payment_date,
      'payment_method', payment_method,
      'payment_reference', payment_reference,
      'notes', notes,
      'created_at', created_at,
      'updated_at', updated_at
    )
  )
  INTO v_result
  FROM ordered_salaries;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- ============================================
-- Function: get_professionals_with_salary
-- Source: 20260303000000_lgpd_hardening_rpcs_and_consent.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_professionals_with_salary(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;
  v_requester_is_admin BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = v_requester_user_id
      AND p.tenant_id = p_tenant_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, p_tenant_id);
  IF NOT v_requester_is_admin THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH ordered_professionals AS (
    SELECT
      pc.user_id AS professional_id,
      COALESCE(p.full_name, 'Profissional') AS professional_name,
      pc.salary_amount,
      pc.salary_payment_day,
      pc.default_payment_method,
      pc.id AS commission_id
    FROM public.professional_commissions pc
    LEFT JOIN public.profiles p ON p.user_id = pc.user_id
    WHERE pc.tenant_id = p_tenant_id
      AND pc.payment_type = 'salary'
      AND pc.salary_amount IS NOT NULL
      AND pc.salary_amount > 0
    ORDER BY COALESCE(p.full_name, 'Profissional')
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'professional_id', professional_id,
      'professional_name', professional_name,
      'salary_amount', salary_amount,
      'salary_payment_day', salary_payment_day,
      'default_payment_method', default_payment_method,
      'commission_id', commission_id
    )
  )
  INTO v_result
  FROM ordered_professionals;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- ============================================
-- Function: get_dashboard_salary_totals
-- Source: 20260228000000_fix_salary_rpcs_and_dashboard.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_salary_totals(
  p_tenant_id UUID,
  p_is_admin BOOLEAN,
  p_professional_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_current_month INTEGER;
  v_current_year INTEGER;
BEGIN
  v_month_start := date_trunc('month', now());
  v_month_end := date_trunc('month', now()) + interval '1 month' - interval '1 second';
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  -- Segurança: chamador deve pertencer ao tenant
  IF current_setting('app.current_user_id')::uuid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = current_setting('app.current_user_id')::uuid
  ) THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  -- Staff só pode ver próprios salários
  IF NOT p_is_admin AND p_professional_user_id IS NOT NULL AND p_professional_user_id != current_setting('app.current_user_id')::uuid THEN
    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);
  END IF;

  IF p_is_admin THEN
    -- Admin: calcular salários a pagar (profissionais com salário configurado que ainda não foram pagos no mês)
    -- Primeiro, buscar profissionais com salário configurado
    SELECT COALESCE(SUM(pc.salary_amount), 0)
    INTO v_pending
    FROM professional_commissions pc
    WHERE pc.tenant_id = p_tenant_id
      AND pc.payment_type = 'salary'
      AND pc.salary_amount IS NOT NULL
      AND pc.salary_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM salary_payments sp
        WHERE sp.tenant_id = p_tenant_id
          AND sp.professional_id = pc.user_id
          AND sp.payment_year = v_current_year
          AND sp.payment_month = v_current_month
          AND sp.status = 'paid'
      );

    -- Admin: calcular salários pagos no mês
    SELECT COALESCE(SUM(sp.amount), 0)
    INTO v_paid
    FROM salary_payments sp
    WHERE sp.tenant_id = p_tenant_id
      AND sp.payment_year = v_current_year
      AND sp.payment_month = v_current_month
      AND sp.status = 'paid';
  ELSE
    -- Staff: apenas seus próprios salários
    IF p_professional_user_id IS NOT NULL THEN
      -- Staff: verificar se tem salário configurado e não foi pago
      SELECT COALESCE(SUM(pc.salary_amount), 0)
      INTO v_pending
      FROM professional_commissions pc
      WHERE pc.tenant_id = p_tenant_id
        AND pc.user_id = p_professional_user_id
        AND pc.payment_type = 'salary'
        AND pc.salary_amount IS NOT NULL
        AND pc.salary_amount > 0
        AND NOT EXISTS (
          SELECT 1 FROM salary_payments sp
          WHERE sp.tenant_id = p_tenant_id
            AND sp.professional_id = p_professional_user_id
            AND sp.payment_year = v_current_year
            AND sp.payment_month = v_current_month
            AND sp.status = 'paid'
        );

      -- Staff: calcular salários pagos no mês
      SELECT COALESCE(SUM(sp.amount), 0)
      INTO v_paid
      FROM salary_payments sp
      WHERE sp.tenant_id = p_tenant_id
        AND sp.professional_id = p_professional_user_id
        AND sp.payment_year = v_current_year
        AND sp.payment_month = v_current_month
        AND sp.status = 'paid';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pending', (v_pending)::float,
    'paid', (v_paid)::float
  );
END;
$$;


-- ============================================
-- Function: create_financial_transaction_v2
-- Source: 20260310100000_enterprise_agenda_finance_rpcs.sql
-- ============================================
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
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
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


-- ============================================
-- Function: get_open_cash_session_summary_v1
-- Source: 20260310151000_dashboard_open_cash_summary_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_open_cash_session_summary_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
  v_profile public.profiles%rowtype;
  v_session_id uuid;
  v_summary jsonb;
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

  SELECT cs.id INTO v_session_id
  FROM public.cash_sessions cs
  WHERE cs.tenant_id = v_profile.tenant_id
    AND cs.status = 'open'
  ORDER BY cs.opened_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'has_open_session', false);
  END IF;

  SELECT public.get_cash_session_summary_v1(v_session_id) INTO v_summary;

  RETURN jsonb_build_object(
    'success', true,
    'has_open_session', true,
    'session_id', v_session_id,
    'summary', v_summary,
    'expected_closing_balance', COALESCE((v_summary->>'expected_closing_balance')::numeric, 0)
  );
END;
$$;


-- ============================================
-- Function: get_dre_simple_v1
-- Source: 20260312042000_orders_paid_at_bi_v1.sql
-- ============================================
create or replace function public.get_dre_simple_v1(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_setting('app.current_user_id')::uuid;
  v_profile public.profiles%rowtype;
  v_is_admin boolean;

  v_start date;
  v_end date;

  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_cogs numeric := 0;

  v_gross_profit numeric := 0;
  v_net_profit numeric := 0;

  v_gross_margin_pct numeric := null;
  v_net_margin_pct numeric := null;

  v_income_by_category jsonb := '[]'::jsonb;
  v_expense_by_category jsonb := '[]'::jsonb;
  v_cogs_by_product jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    perform public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  end if;

  if p_start_date is null or p_end_date is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'Informe start_date e end_date');
  end if;

  if p_end_date < p_start_date then
    perform public.raise_app_error('VALIDATION_ERROR', 'end_date deve ser >= start_date');
  end if;

  v_start := p_start_date;
  v_end := p_end_date;

  select * into v_profile
  from public.profiles p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    perform public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  end if;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);
  if not v_is_admin then
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem ver relatórios');
  end if;

  -- Receita
  select coalesce(sum(ft.amount), 0)
    into v_revenue
  from public.financial_transactions ft
  where ft.tenant_id = v_profile.tenant_id
    and ft.type = 'income'
    and ft.transaction_date >= v_start
    and ft.transaction_date <= v_end;

  -- Despesas
  select coalesce(sum(ft.amount), 0)
    into v_expenses
  from public.financial_transactions ft
  where ft.tenant_id = v_profile.tenant_id
    and ft.type = 'expense'
    and ft.transaction_date >= v_start
    and ft.transaction_date <= v_end;

  -- CMV: somar snapshot de custo de itens de produto em pedidos pagos
  select coalesce(sum(oi.total_cost_snapshot), 0)
    into v_cogs
  from public.orders o
  join public.order_items oi
    on oi.order_id = o.id
   and oi.tenant_id = o.tenant_id
  where o.tenant_id = v_profile.tenant_id
    and o.status = 'paid'
    and oi.kind = 'product'
    and oi.total_cost_snapshot is not null
    and o.paid_at is not null
    and (o.paid_at at time zone 'America/Sao_Paulo')::date >= v_start
    and (o.paid_at at time zone 'America/Sao_Paulo')::date <= v_end;

  v_gross_profit := v_revenue - v_cogs;
  v_net_profit := v_revenue - v_cogs - v_expenses;

  if v_revenue > 0 then
    v_gross_margin_pct := round((v_gross_profit / v_revenue) * 100, 2);
    v_net_margin_pct := round((v_net_profit / v_revenue) * 100, 2);
  end if;

  -- Breakdown: receita por categoria
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', category,
        'amount', amount
      )
      order by amount desc
    ),
    '[]'::jsonb
  )
  into v_income_by_category
  from (
    select ft.category,
           round(sum(ft.amount), 2) as amount
    from public.financial_transactions ft
    where ft.tenant_id = v_profile.tenant_id
      and ft.type = 'income'
      and ft.transaction_date >= v_start
      and ft.transaction_date <= v_end
    group by ft.category
  ) s;

  -- Breakdown: despesa por categoria
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category', category,
        'amount', amount
      )
      order by amount desc
    ),
    '[]'::jsonb
  )
  into v_expense_by_category
  from (
    select ft.category,
           round(sum(ft.amount), 2) as amount
    from public.financial_transactions ft
    where ft.tenant_id = v_profile.tenant_id
      and ft.type = 'expense'
      and ft.transaction_date >= v_start
      and ft.transaction_date <= v_end
    group by ft.category
  ) s;

  -- Breakdown: CMV por produto (top 20)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'product_name', product_name,
        'amount', amount
      )
      order by amount desc
    ),
    '[]'::jsonb
  )
  into v_cogs_by_product
  from (
    select oi.product_id,
           max(p.name) as product_name,
           round(sum(oi.total_cost_snapshot), 2) as amount
    from public.orders o
    join public.order_items oi
      on oi.order_id = o.id
     and oi.tenant_id = o.tenant_id
    join public.products p
      on p.id = oi.product_id
     and p.tenant_id = o.tenant_id
    where o.tenant_id = v_profile.tenant_id
      and o.status = 'paid'
      and oi.kind = 'product'
      and oi.total_cost_snapshot is not null
      and o.paid_at is not null
      and (o.paid_at at time zone 'America/Sao_Paulo')::date >= v_start
      and (o.paid_at at time zone 'America/Sao_Paulo')::date <= v_end
    group by oi.product_id
    order by sum(oi.total_cost_snapshot) desc
    limit 20
  ) s;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'bi_dre_viewed',
    'bi_report',
    null,
    jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end
    )
  );

  return jsonb_build_object(
    'success', true,
    'start_date', v_start,
    'end_date', v_end,
    'revenue', round(v_revenue, 2),
    'cogs', round(v_cogs, 2),
    'expenses', round(v_expenses, 2),
    'gross_profit', round(v_gross_profit, 2),
    'net_profit', round(v_net_profit, 2),
    'gross_margin_pct', v_gross_margin_pct,
    'net_margin_pct', v_net_margin_pct,
    'income_by_category', v_income_by_category,
    'expense_by_category', v_expense_by_category,
    'cogs_by_product', v_cogs_by_product
  );
end;
$$;


-- ============================================
-- Function: get_cash_flow_projection_v1
-- Source: 20260319020000_financeiro_avancado_phase2_v1.sql
-- ============================================
create or replace function public.get_cash_flow_projection_v1(
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_end_date date;

  v_actual_balance numeric := 0;
  v_projected_payable numeric := 0;
  v_projected_receivable numeric := 0;

  v_series jsonb := '[]'::jsonb;
  v_day date;
  v_running numeric := 0;
  v_day_income numeric;
  v_day_expense numeric;
  v_day_payable numeric;
  v_day_receivable numeric;
  v_pending_payable numeric;
  v_pending_receivable numeric;
begin
  v_tenant_id := public.get_user_tenant_id(current_setting('app.current_user_id')::uuid);

  if v_tenant_id is null then
    raise exception 'Tenant não encontrado';
  end if;

  if not public.is_tenant_admin(current_setting('app.current_user_id')::uuid, v_tenant_id) then
    raise exception 'Sem permissão';
  end if;

  p_days := least(greatest(coalesce(p_days, 30), 7), 180);
  v_end_date := v_today + p_days;

  -- Opening balance: sum of all financial transactions up to yesterday
  select coalesce(
    sum(case when type = 'income' then amount else -amount end), 0
  ) into v_actual_balance
  from public.financial_transactions
  where tenant_id = v_tenant_id
    and transaction_date < v_today;

  -- Pending payable total in window
  select coalesce(sum(amount), 0) into v_projected_payable
  from public.bills_payable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date between v_today and v_end_date;

  -- Pending receivable total in window
  select coalesce(sum(amount), 0) into v_projected_receivable
  from public.bills_receivable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date between v_today and v_end_date;

  -- Build day-by-day series
  v_running := v_actual_balance;
  v_day := v_today - 7; -- include 7 days of history

  while v_day <= v_end_date loop
    -- Actual income/expense for this day
    select
      coalesce(sum(case when type='income' then amount else 0 end),0),
      coalesce(sum(case when type='expense' then amount else 0 end),0)
    into v_day_income, v_day_expense
    from public.financial_transactions
    where tenant_id = v_tenant_id
      and transaction_date = v_day;

    -- Projected payable for this day
    select coalesce(sum(amount),0) into v_day_payable
    from public.bills_payable
    where tenant_id = v_tenant_id
      and status = 'pending'
      and due_date = v_day;

    -- Projected receivable for this day
    select coalesce(sum(amount),0) into v_day_receivable
    from public.bills_receivable
    where tenant_id = v_tenant_id
      and status = 'pending'
      and due_date = v_day;

    v_running := v_running + v_day_income - v_day_expense;

    v_series := v_series || jsonb_build_object(
      'date', v_day::text,
      'actual_income', (v_day_income)::float,
      'actual_expense', (v_day_expense)::float,
      'projected_payable', (v_day_payable)::float,
      'projected_receivable', (v_day_receivable)::float,
      'running_balance', (v_running)::float,
      'is_past', v_day < v_today
    );

    v_day := v_day + 1;
  end loop;

  -- Pending bills outside window (overdue)
  select coalesce(sum(amount),0) into v_pending_payable
  from public.bills_payable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date < v_today;

  select coalesce(sum(amount),0) into v_pending_receivable
  from public.bills_receivable
  where tenant_id = v_tenant_id
    and status = 'pending'
    and due_date < v_today;

  return jsonb_build_object(
    'success', true,
    'days', p_days,
    'today', v_today::text,
    'opening_balance', (v_actual_balance)::float,
    'projected_payable_window', (v_projected_payable)::float,
    'projected_receivable_window', (v_projected_receivable)::float,
    'overdue_payable', (v_pending_payable)::float,
    'overdue_receivable', (v_pending_receivable)::float,
    'series', v_series
  );
end;
$$;


-- ============================================
-- Function: get_patient_payment_history
-- Source: 20260326500000_patient_portal_fix_queries_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_payment_history(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, invoice_id uuid, invoice_description text, amount numeric,
  payment_method text, status text, paid_at timestamptz, receipt_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF current_setting('app.current_user_id')::uuid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = current_setting('app.current_user_id')::uuid AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT pp.id, pp.invoice_id, pi.description, pp.amount,
    pp.payment_method, pp.status, pp.paid_at, pp.receipt_url
  FROM public.patient_payments pp
  JOIN public.patient_invoices pi ON pi.id = pp.invoice_id
  WHERE pi.client_id = v_client_id
  ORDER BY pp.paid_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ============================================
-- Function: trg_update_invoice_on_payment
-- Source: 20260326100000_patient_portal_financial_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_update_invoice_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE public.patient_invoices
    SET 
      status = 'paid',
      paid_at = NEW.paid_at,
      paid_amount = NEW.amount,
      payment_method = NEW.payment_method,
      updated_at = now()
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_applicable_commission_rule
-- Source: 20260703950000_restore_commission_integration.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_applicable_commission_rule(
    p_tenant_id UUID,
    p_professional_id UUID,
    p_procedure_id UUID DEFAULT NULL,
    p_insurance_id UUID DEFAULT NULL,
    p_procedure_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    rule_id UUID,
    rule_type public.commission_rule_type,
    calculation_type public.commission_calculation_type,
    value DECIMAL(10,2),
    tier_config JSONB,
    is_inverted BOOLEAN,
    priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Retorna a regra mais específica (maior prioridade) que se aplica.
    -- Ordem de prioridade: procedure (30) > service (20) > insurance (10) > referral (5) > default (0)
    RETURN QUERY
    SELECT
        cr.id AS rule_id,
        cr.rule_type,
        cr.calculation_type,
        cr.value,
        cr.tier_config,
        cr.is_inverted,
        cr.priority
    FROM public.commission_rules cr
    WHERE cr.tenant_id = p_tenant_id
      AND cr.professional_id = p_professional_id
      AND cr.is_active = TRUE
      AND (
          -- Regra por código TUSS (procedimento — mais específica)
          (cr.rule_type = 'procedure' AND cr.procedure_code = p_procedure_code AND p_procedure_code IS NOT NULL)
          OR
          -- Regra por procedimento/serviço cadastrado
          (cr.rule_type = 'service' AND cr.procedure_id = p_procedure_id AND p_procedure_id IS NOT NULL)
          OR
          -- Regra por convênio
          (cr.rule_type = 'insurance' AND cr.insurance_id = p_insurance_id AND p_insurance_id IS NOT NULL)
          OR
          -- Regra default (fallback)
          (cr.rule_type = 'default')
      )
    ORDER BY cr.priority DESC, cr.created_at DESC
    LIMIT 1;
END;
$$;


-- ============================================
-- Function: calculate_commission_amount
-- Source: 20260703950000_restore_commission_integration.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_commission_amount(
    p_calculation_type public.commission_calculation_type,
    p_value DECIMAL(10,2),
    p_tier_config JSONB,
    p_service_price DECIMAL(10,2),
    p_monthly_revenue DECIMAL(10,2) DEFAULT 0
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_tier RECORD;
    v_applicable_rate DECIMAL(10,2);
BEGIN
    IF p_calculation_type = 'fixed' THEN
        RETURN p_value;
    ELSIF p_calculation_type = 'percentage' THEN
        RETURN ROUND((p_service_price * p_value) / 100, 2);
    ELSIF p_calculation_type = 'tiered' AND p_tier_config IS NOT NULL THEN
        v_applicable_rate := p_value; -- fallback para o valor base

        FOR v_tier IN
            SELECT
                (tier->>'min')::DECIMAL AS tier_min,
                (tier->>'max')::DECIMAL AS tier_max,
                (tier->>'value')::DECIMAL AS tier_value
            FROM jsonb_array_elements(p_tier_config) AS tier
            ORDER BY (tier->>'min')::DECIMAL ASC
        LOOP
            IF p_monthly_revenue >= v_tier.tier_min
               AND (v_tier.tier_max IS NULL OR p_monthly_revenue <= v_tier.tier_max) THEN
                v_applicable_rate := v_tier.tier_value;
            END IF;
        END LOOP;

        RETURN ROUND((p_service_price * v_applicable_rate) / 100, 2);
    END IF;

    RETURN 0;
END;
$$;


-- ============================================
-- Function: calculate_referral_commission
-- Source: 20260327300000_referral_commission_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_referral_commission(
    p_appointment_id UUID
)
RETURNS TABLE (
    referrer_id UUID,
    referrer_name TEXT,
    commission_amount DECIMAL(10,2),
    rule_id UUID,
    calculation_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
    v_rule RECORD;
    v_amount DECIMAL(10,2);
BEGIN
    -- Buscar dados do agendamento
    SELECT 
        a.id,
        a.tenant_id,
        a.booked_by_id,
        a.service_id,
        a.insurance_id,
        COALESCE(s.price, 0) AS service_price,
        p.full_name AS referrer_name
    INTO v_appointment
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.profiles p ON p.user_id = a.booked_by_id
    WHERE a.id = p_appointment_id;

    -- Se não tem booked_by_id, não há comissão de captação
    IF v_appointment.booked_by_id IS NULL THEN
        RETURN;
    END IF;

    -- Buscar regra de captação aplicável
    SELECT cr.*
    INTO v_rule
    FROM public.commission_rules cr
    WHERE cr.tenant_id = v_appointment.tenant_id
    AND cr.professional_id = v_appointment.booked_by_id
    AND cr.rule_type = 'referral'
    AND cr.is_active = TRUE
    ORDER BY cr.priority DESC
    LIMIT 1;

    -- Se não encontrou regra específica de captação, não há comissão
    IF v_rule.id IS NULL THEN
        RETURN;
    END IF;

    -- Calcular valor da comissão
    IF v_rule.calculation_type = 'percentage' THEN
        v_amount := (v_appointment.service_price * v_rule.value) / 100;
    ELSIF v_rule.calculation_type = 'fixed' THEN
        v_amount := v_rule.value;
    ELSE
        v_amount := 0;
    END IF;

    -- Retornar resultado
    RETURN QUERY SELECT 
        v_appointment.booked_by_id,
        v_appointment.referrer_name,
        v_amount,
        v_rule.id,
        v_rule.calculation_type::TEXT;
END;
$$;


-- ============================================
-- Function: get_active_payment_gateway
-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_active_payment_gateway(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    provider public.payment_gateway_provider,
    api_key_encrypted TEXT,
    webhook_secret_encrypted TEXT,
    environment TEXT,
    is_split_enabled BOOLEAN,
    split_fee_payer TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.provider,
        g.api_key_encrypted,
        g.webhook_secret_encrypted,
        g.environment,
        g.is_split_enabled,
        g.split_fee_payer
    FROM public.tenant_payment_gateways g
    WHERE g.tenant_id = p_tenant_id
    AND g.is_active = TRUE
    AND g.validation_status = 'valid'
    ORDER BY g.updated_at DESC
    LIMIT 1;
END;
$$;


-- ============================================
-- Function: get_professional_payment_account
-- Source: 20260327600000_payment_gateway_infrastructure_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_professional_payment_account(
    p_tenant_id UUID,
    p_professional_id UUID
)
RETURNS TABLE (
    id UUID,
    provider public.payment_gateway_provider,
    recipient_id TEXT,
    wallet_id TEXT,
    account_id TEXT,
    is_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gateway_id UUID;
BEGIN
    -- Buscar gateway ativo do tenant
    SELECT g.id INTO v_gateway_id
    FROM public.tenant_payment_gateways g
    WHERE g.tenant_id = p_tenant_id
    AND g.is_active = TRUE
    AND g.validation_status = 'valid'
    LIMIT 1;

    IF v_gateway_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        pa.id,
        pa.provider,
        pa.recipient_id,
        pa.wallet_id,
        pa.account_id,
        pa.is_verified
    FROM public.professional_payment_accounts pa
    WHERE pa.tenant_id = p_tenant_id
    AND pa.professional_id = p_professional_id
    AND pa.gateway_id = v_gateway_id
    AND pa.is_verified = TRUE
    LIMIT 1;
END;
$$;


-- ============================================
-- Function: notify_commission_generated
-- Source: 20260327700000_financial_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_commission_generated()
RETURNS TRIGGER AS $$
DECLARE
  v_professional_name TEXT;
  v_service_name TEXT;
  v_client_name TEXT;
  v_percentage NUMERIC;
  v_wants_notification BOOLEAN;
BEGIN
  -- Verificar se profissional quer receber notificação
  SELECT COALESCE(commission_generated, true) INTO v_wants_notification
  FROM public.user_notification_preferences
  WHERE user_id = NEW.professional_id;

  IF v_wants_notification IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Buscar dados para a notificação
  SELECT full_name INTO v_professional_name
  FROM public.profiles
  WHERE user_id = NEW.professional_id;

  -- Buscar nome do serviço e cliente via appointment
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT 
      s.name,
      c.name
    INTO v_service_name, v_client_name
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.clients c ON c.id = a.client_id
    WHERE a.id = NEW.appointment_id;
  END IF;

  -- Calcular percentual
  IF NEW.service_price > 0 THEN
    v_percentage := ROUND((NEW.amount / NEW.service_price) * 100, 0);
  ELSE
    v_percentage := 0;
  END IF;

  -- Criar notificação
  INSERT INTO public.notifications (
    tenant_id,
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.professional_id,
    'commission_generated',
    'Comissão gerada',
    format(
      'Comissão de R$ %s gerada (%s%% de R$ %s)%s',
      to_char(NEW.amount, 'FM999G999D00'),
      v_percentage::TEXT,
      to_char(NEW.service_price, 'FM999G999D00'),
      CASE WHEN v_service_name IS NOT NULL THEN ' - ' || v_service_name ELSE '' END
    ),
    jsonb_build_object(
      'commission_id', NEW.id,
      'amount', NEW.amount,
      'service_price', NEW.service_price,
      'percentage', v_percentage,
      'service_name', v_service_name,
      'client_name', v_client_name,
      'appointment_id', NEW.appointment_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: notify_commission_paid
-- Source: 20260327700000_financial_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_commission_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_wants_notification BOOLEAN;
  v_total_paid NUMERIC;
BEGIN
  -- Só notificar quando status muda para 'paid'
  IF OLD.status = 'paid' OR NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Verificar se profissional quer receber notificação
  SELECT COALESCE(commission_paid, true) INTO v_wants_notification
  FROM public.user_notification_preferences
  WHERE user_id = NEW.professional_id;

  IF v_wants_notification IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Criar notificação
  INSERT INTO public.notifications (
    tenant_id,
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.professional_id,
    'commission_paid',
    'Comissão paga',
    format('Sua comissão de R$ %s foi paga!', to_char(NEW.amount, 'FM999G999D00')),
    jsonb_build_object(
      'commission_id', NEW.id,
      'amount', NEW.amount,
      'payment_date', NEW.payment_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: notify_salary_paid
-- Source: 20260327700000_financial_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_salary_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_wants_notification BOOLEAN;
  v_month_name TEXT;
  v_payment_method_label TEXT;
BEGIN
  -- Só notificar quando status muda para 'paid'
  IF OLD.status = 'paid' OR NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Verificar se profissional quer receber notificação
  SELECT COALESCE(salary_paid, true) INTO v_wants_notification
  FROM public.user_notification_preferences
  WHERE user_id = NEW.professional_id;

  IF v_wants_notification IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Nome do mês
  v_month_name := to_char(make_date(NEW.payment_year, NEW.payment_month, 1), 'TMMonth');

  -- Label do método de pagamento
  v_payment_method_label := CASE NEW.payment_method
    WHEN 'pix' THEN 'via PIX'
    WHEN 'deposit' THEN 'via depósito'
    WHEN 'transfer' THEN 'via transferência'
    WHEN 'cash' THEN 'em espécie'
    ELSE ''
  END;

  -- Criar notificação
  INSERT INTO public.notifications (
    tenant_id,
    user_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.professional_id,
    'salary_paid',
    'Salário pago',
    format(
      'Seu salário de %s (R$ %s) foi pago%s',
      v_month_name,
      to_char(NEW.amount, 'FM999G999D00'),
      CASE WHEN v_payment_method_label != '' THEN ' ' || v_payment_method_label ELSE '' END
    ),
    jsonb_build_object(
      'salary_id', NEW.id,
      'amount', NEW.amount,
      'payment_month', NEW.payment_month,
      'payment_year', NEW.payment_year,
      'payment_method', NEW.payment_method,
      'payment_date', NEW.payment_date
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: calculate_professional_commission_on_receivables
-- Source: 20260330100000_financial_refactor_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_professional_commission_on_receivables(
  p_professional_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := current_setting('app.current_user_id')::uuid;
  v_tenant_id UUID;
  v_commission_config RECORD;
  v_total_received NUMERIC := 0;
  v_commission_amount NUMERIC := 0;
  v_receivables_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar tenant do profissional
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = p_professional_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado';
  END IF;

  -- Verificar permissões
  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem calcular comissões';
  END IF;

  -- Buscar configuração de comissão do profissional
  SELECT pc.*
  INTO v_commission_config
  FROM public.professional_commissions pc
  JOIN public.profiles p ON p.user_id = pc.user_id
  WHERE p.id = p_professional_id
    AND pc.tenant_id = v_tenant_id
    AND (pc.payment_type IS NULL OR lower(trim(pc.payment_type)) = 'commission')
  ORDER BY pc.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_commission_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profissional não possui configuração de comissão',
      'total_received', 0,
      'commission_amount', 0
    );
  END IF;

  -- Calcular total recebido no período
  SELECT 
    COALESCE(SUM(ar.amount_paid), 0),
    COUNT(*)
  INTO v_total_received, v_receivables_count
  FROM public.accounts_receivable ar
  WHERE ar.professional_id = p_professional_id
    AND ar.tenant_id = v_tenant_id
    AND ar.status IN ('paid', 'partial')
    AND ar.paid_at >= p_start_date
    AND ar.paid_at < (p_end_date + INTERVAL '1 day');

  -- Calcular comissão
  IF v_commission_config.type = 'percentage' THEN
    v_commission_amount := v_total_received * (v_commission_config.value / 100);
  ELSE
    -- Comissão fixa por atendimento
    v_commission_amount := v_commission_config.value * v_receivables_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'professional_id', p_professional_id,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'total_received', v_total_received,
    'receivables_count', v_receivables_count,
    'commission_type', v_commission_config.type,
    'commission_value', v_commission_config.value,
    'commission_amount', v_commission_amount
  );
END;
$$;


-- ============================================
-- Function: create_receivable_on_tiss_approval
-- Source: 20260330100000_financial_refactor_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_receivable_on_tiss_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando uma guia TISS é aprovada (status muda para 'approved' ou 'partial')
  IF NEW.status IN ('approved', 'partial') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'partial')) THEN
    -- Criar conta a receber se não existir
    INSERT INTO public.accounts_receivable (
      tenant_id,
      appointment_id,
      client_id,
      tiss_guide_id,
      service_price,
      amount_due,
      amount_paid,
      payment_source,
      status,
      due_date,
      description
    )
    SELECT
      NEW.tenant_id,
      NEW.appointment_id,
      a.client_id,
      NEW.id,
      COALESCE(NEW.approved_value, NEW.total_value, 0),
      COALESCE(NEW.approved_value, NEW.total_value, 0),
      0,
      'insurance'::public.payment_source,
      'pending'::public.receivable_status,
      CURRENT_DATE + INTERVAL '30 days',
      'Guia TISS aprovada: ' || COALESCE(NEW.guide_number, NEW.id::text)
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
    AND NOT EXISTS (
      SELECT 1 FROM public.accounts_receivable ar
      WHERE ar.tiss_guide_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

