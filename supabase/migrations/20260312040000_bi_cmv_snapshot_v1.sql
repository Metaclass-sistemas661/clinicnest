-- Milestone 8 (parte 1): CMV correto (snapshot de custo por item vendido)

-- 1) Colunas de snapshot em order_items
alter table public.order_items
  add column if not exists unit_cost_snapshot numeric(12,4);

alter table public.order_items
  add column if not exists total_cost_snapshot numeric(12,4);

create index if not exists idx_order_items_tenant_kind_created
  on public.order_items(tenant_id, kind, created_at desc);


-- 2) Patch finalize_order_v1: preencher snapshot do custo no momento da baixa
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
  v_user_id       uuid := auth.uid();
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
  SET status = 'paid', updated_at = now()
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

REVOKE ALL ON FUNCTION public.finalize_order_v1(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_order_v1(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_order_v1(uuid, jsonb) TO service_role;
