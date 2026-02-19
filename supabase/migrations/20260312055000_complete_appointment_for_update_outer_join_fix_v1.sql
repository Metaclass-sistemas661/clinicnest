-- Fix: erro "FOR UPDATE cannot be applied to the nullable side of an outer join".
-- O Postgres não permite FOR UPDATE em SELECT com LEFT JOIN.
-- Solução: travar apenas a tabela base (appointments) com "FOR UPDATE OF a".

CREATE OR REPLACE FUNCTION public.complete_appointment_with_sale(
  p_appointment_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
  v_requester_profile_id UUID;
  v_requester_is_admin BOOLEAN := FALSE;

  v_tenant_id UUID;

  v_appointment RECORD;
  v_product RECORD;
  v_professional_user_id UUID;
  v_professional_name TEXT;
  v_commission_config RECORD;
  v_config_type TEXT := '';

  v_commission_amount NUMERIC := 0;
  v_service_price NUMERIC := 0;
  v_service_profit NUMERIC := 0;
  v_product_revenue NUMERIC := 0;
  v_product_cost NUMERIC := 0;
  v_product_profit NUMERIC := 0;
  v_total_profit NUMERIC := 0;
  v_product_sales JSONB := '[]'::jsonb;
  v_description TEXT;

  v_commission_payment_id UUID;
  v_commission_reason TEXT := '';
  v_commission_created BOOLEAN := FALSE;

  v_already_completed BOOLEAN := FALSE;

  v_tx_date date;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NOT NULL AND p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade de produto não pode ser negativa';
  END IF;

  IF p_product_id IS NOT NULL AND (p_quantity IS NULL OR p_quantity <= 0) THEN
    RAISE EXCEPTION 'Quantidade de produto deve ser maior que zero quando houver produto';
  END IF;

  -- Strict single-worker per appointment within the same transaction
  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('complete_appointment_with_sale'));

  SELECT
    a.*,
    s.name AS service_name,
    c.name AS client_name,
    COALESCE(a.price, s.price, 0)::numeric AS effective_price
  INTO v_appointment
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = p_appointment_id
  FOR UPDATE OF a;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  v_tenant_id := v_appointment.tenant_id;

  SELECT p.id
  INTO v_requester_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_requester_user_id
    AND p.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_requester_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado no tenant do agendamento';
  END IF;

  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, v_tenant_id);

  IF NOT v_requester_is_admin
     AND v_appointment.professional_id IS DISTINCT FROM v_requester_profile_id THEN
    RAISE EXCEPTION 'Sem permissão para concluir este agendamento';
  END IF;

  v_already_completed := (v_appointment.status = 'completed');

  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.user_id, p.full_name
    INTO v_professional_user_id, v_professional_name
    FROM public.profiles p
    WHERE p.id = v_appointment.professional_id
      AND p.tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  IF v_already_completed THEN
    -- Mantém comportamento idempotente: não duplicar efeitos e retorna o mesmo payload.
    SELECT cp.id, cp.amount
    INTO v_commission_payment_id, v_commission_amount
    FROM public.commission_payments cp
    WHERE cp.appointment_id = p_appointment_id
    LIMIT 1;

    v_service_price := COALESCE(v_appointment.effective_price, 0);
    v_service_profit := v_service_price - COALESCE(v_commission_amount, 0);

    SELECT s.product_sales, s.product_profit_total, s.total_profit
    INTO v_product_sales, v_product_profit, v_total_profit
    FROM public.appointment_completion_summaries s
    WHERE s.appointment_id = p_appointment_id
    LIMIT 1;

    v_total_profit := COALESCE(v_total_profit, v_service_profit + COALESCE(v_product_profit, 0));

    RETURN jsonb_build_object(
      'already_completed', true,
      'commission_amount', (COALESCE(v_commission_amount, 0))::float,
      'commission_created', false,
      'commission_reason', 'already_completed',
      'commission_payment_id', v_commission_payment_id,
      'service_price', (v_service_price)::float,
      'service_name', COALESCE(v_appointment.service_name, 'Serviço'),
      'professional_name', COALESCE(v_professional_name, ''),
      'service_profit', (v_service_profit)::float,
      'product_sales', COALESCE(v_product_sales, '[]'::jsonb),
      'product_profit_total', (COALESCE(v_product_profit, 0))::float,
      'total_profit', (COALESCE(v_total_profit, 0))::float
    );
  END IF;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_service_price := COALESCE(v_appointment.effective_price, 0);

  -- Receita do serviço (para refletir no saldo do dia quando conclui atendimento)
  IF v_service_price > 0 THEN
    INSERT INTO public.financial_transactions (
      tenant_id,
      appointment_id,
      type,
      category,
      amount,
      description,
      transaction_date
    ) VALUES (
      v_tenant_id,
      p_appointment_id,
      'income',
      'Serviço',
      v_service_price,
      'Atendimento concluído — ' || COALESCE(v_appointment.service_name, 'Serviço'),
      v_tx_date
    )
    ON CONFLICT (appointment_id, type, category) DO NOTHING;
  END IF;

  -- Venda de produto (mantém lógica existente, com data no fuso)
  IF p_product_id IS NOT NULL THEN
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
      AND tenant_id = v_tenant_id
    LIMIT 1;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;

    IF v_product.quantity < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto selecionado.';
    END IF;

    v_product_revenue := COALESCE(v_product.sale_price, v_product.cost, 0) * p_quantity;
    v_product_cost := COALESCE(v_product.cost, 0) * p_quantity;
    v_product_profit := v_product_revenue - v_product_cost;

    v_product_sales := jsonb_build_array(
      jsonb_build_object(
        'product_name', v_product.name,
        'quantity', p_quantity,
        'revenue', (v_product_revenue)::float,
        'cost', (v_product_cost)::float,
        'profit', (v_product_profit)::float
      )
    );

    INSERT INTO public.stock_movements (
      tenant_id,
      product_id,
      quantity,
      movement_type,
      out_reason_type,
      reason,
      created_by
    ) VALUES (
      v_tenant_id,
      p_product_id,
      -p_quantity,
      'out',
      'sale',
      COALESCE('Venda durante o serviço ' || v_appointment.service_name, 'Venda durante atendimento'),
      v_requester_profile_id
    );

    UPDATE public.products
    SET quantity = quantity - p_quantity
    WHERE id = p_product_id
      AND tenant_id = v_tenant_id;

    v_description := 'Venda de ' || v_product.name || ' (' || p_quantity || ' un.)';
    IF v_appointment.service_name IS NOT NULL THEN
      v_description := v_description || ' · Serviço: ' || v_appointment.service_name;
    END IF;
    IF v_appointment.client_name IS NOT NULL THEN
      v_description := v_description || ' · Cliente: ' || v_appointment.client_name;
    END IF;

    INSERT INTO public.financial_transactions (
      tenant_id,
      type,
      category,
      amount,
      description,
      transaction_date,
      product_id,
      appointment_id
    ) VALUES (
      v_tenant_id,
      'income',
      'Venda de Produto',
      v_product_revenue,
      v_description,
      v_tx_date,
      p_product_id,
      p_appointment_id
    )
    ON CONFLICT (appointment_id, product_id, type, category) DO NOTHING;
  END IF;

  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id
    AND status <> 'completed';

  IF v_professional_user_id IS NULL THEN
    v_commission_reason := 'missing_professional_user_id';
  ELSE
    SELECT pc.*
    INTO v_commission_config
    FROM public.professional_commissions pc
    WHERE pc.user_id = v_professional_user_id
      AND pc.tenant_id = v_tenant_id
      AND (pc.payment_type IS NULL OR lower(trim(pc.payment_type)) = 'commission')
    ORDER BY pc.updated_at DESC NULLS LAST, pc.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_commission_config IS NULL THEN
      v_commission_reason := 'missing_config';
    ELSIF COALESCE(v_commission_config.value, 0) <= 0 THEN
      v_commission_reason := 'config_value_zero';
    ELSE
      v_config_type := lower(trim(COALESCE(v_commission_config.type::text, '')));

      IF v_appointment.commission_amount IS NOT NULL AND v_appointment.commission_amount > 0 THEN
        v_commission_amount := v_appointment.commission_amount;
        v_config_type := 'fixed';
      ELSIF v_config_type = 'percentage' THEN
        v_commission_amount := (v_service_price * v_commission_config.value) / 100;
      ELSE
        v_commission_amount := v_commission_config.value;
      END IF;

      IF v_commission_amount <= 0 THEN
        v_commission_reason := 'amount_zero';
      ELSE
        INSERT INTO public.commission_payments (
          tenant_id,
          professional_id,
          appointment_id,
          commission_config_id,
          amount,
          service_price,
          commission_type,
          commission_value,
          status,
          notes
        ) VALUES (
          v_tenant_id,
          v_professional_user_id,
          p_appointment_id,
          v_commission_config.id,
          v_commission_amount,
          v_service_price,
          CASE
            WHEN v_config_type = 'percentage' THEN 'percentage'::public.commission_type
            ELSE 'fixed'::public.commission_type
          END,
          COALESCE(v_commission_config.value, v_commission_amount),
          'pending',
          'Comissão por ' || COALESCE(v_appointment.service_name, 'serviço')
        )
        ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING
        RETURNING id INTO v_commission_payment_id;

        IF v_commission_payment_id IS NULL THEN
          SELECT cp.id INTO v_commission_payment_id
          FROM public.commission_payments cp
          WHERE cp.appointment_id = p_appointment_id
          LIMIT 1;
          v_commission_created := FALSE;
          v_commission_reason := 'already_exists';
        ELSE
          v_commission_created := TRUE;
          v_commission_reason := 'created';
        END IF;
      END IF;
    END IF;
  END IF;

  v_service_profit := v_service_price - COALESCE(v_commission_amount, 0);
  v_total_profit := v_service_profit + v_product_profit;

  INSERT INTO public.appointment_completion_summaries (
    tenant_id,
    appointment_id,
    professional_name,
    service_name,
    service_profit,
    product_sales,
    product_profit_total,
    total_profit
  ) VALUES (
    v_tenant_id,
    p_appointment_id,
    COALESCE(v_professional_name, ''),
    COALESCE(v_appointment.service_name, 'Serviço'),
    v_service_profit,
    v_product_sales,
    v_product_profit,
    v_total_profit
  )
  ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object(
    'already_completed', false,
    'commission_amount', (COALESCE(v_commission_amount, 0))::float,
    'commission_created', v_commission_created,
    'commission_reason', v_commission_reason,
    'commission_payment_id', v_commission_payment_id,
    'commission_config_id', CASE WHEN v_commission_config IS NOT NULL THEN v_commission_config.id ELSE NULL END,
    'service_price', (v_service_price)::float,
    'service_name', COALESCE(v_appointment.service_name, 'Serviço'),
    'professional_name', COALESCE(v_professional_name, ''),
    'service_profit', (v_service_profit)::float,
    'product_sales', v_product_sales,
    'product_profit_total', (v_product_profit)::float,
    'total_profit', (v_total_profit)::float
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO service_role;
