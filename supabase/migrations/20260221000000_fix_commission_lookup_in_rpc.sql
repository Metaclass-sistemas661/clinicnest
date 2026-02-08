-- Corrige lookup de professional_commissions no RPC complete_appointment_with_sale.
-- Usa v_professional_user_id diretamente (já obtido de profiles) em vez de JOIN que pode falhar.

DROP FUNCTION IF EXISTS public.complete_appointment_with_sale(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.complete_appointment_with_sale(
  p_appointment_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_quantity INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_profile_id UUID;
  v_is_admin BOOLEAN;
  v_appointment RECORD;
  v_product RECORD;
  v_service_name TEXT;
  v_client_name TEXT;
  v_product_name TEXT;
  v_sale_amount DECIMAL(10,2);
  v_product_revenue DECIMAL(10,2);
  v_product_cost DECIMAL(10,2);
  v_description TEXT;
  v_professional_name TEXT;
  v_professional_user_id UUID;
  v_commission_config RECORD;
  v_commission_amount DECIMAL(10,2) := 0;
  v_result JSONB := NULL;
  v_product_sales JSONB := '[]'::jsonb;
  v_product_profit DECIMAL(10,2) := 0;
  v_service_profit DECIMAL(10,2) := 0;
  v_total_profit DECIMAL(10,2) := 0;
BEGIN
  SELECT tenant_id, id INTO v_tenant_id, v_profile_id
  FROM public.profiles WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  v_is_admin := public.is_tenant_admin(auth.uid(), v_tenant_id);

  SELECT a.*, s.name as service_name, c.name as client_name,
         COALESCE(a.price, s.price, 0) as effective_price
  INTO v_appointment
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = p_appointment_id AND a.tenant_id = v_tenant_id;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT v_is_admin AND v_appointment.professional_id IS DISTINCT FROM v_profile_id THEN
    RAISE EXCEPTION 'Sem permissão para concluir este agendamento';
  END IF;

  IF p_product_id IS NOT NULL AND p_quantity IS NOT NULL AND p_quantity > 0 THEN
    SELECT * INTO v_product FROM public.products
    WHERE id = p_product_id AND tenant_id = v_tenant_id;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;

    IF v_product.quantity < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto selecionado.';
    END IF;

    v_product_revenue := COALESCE(v_product.sale_price, v_product.cost, 0) * p_quantity;
    v_product_cost := COALESCE(v_product.cost, 0) * p_quantity;
    v_sale_amount := v_product_revenue;
    v_product_profit := v_product_profit + (v_product_revenue - v_product_cost);
    v_product_sales := v_product_sales || jsonb_build_array(jsonb_build_object(
      'product_name', v_product.name,
      'quantity', p_quantity,
      'revenue', (v_product_revenue)::float,
      'cost', (v_product_cost)::float,
      'profit', ((v_product_revenue - v_product_cost))::float
    ));
    v_service_name := v_appointment.service_name;
    v_client_name := v_appointment.client_name;
    v_product_name := v_product.name;

    INSERT INTO public.stock_movements (
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) VALUES (
      v_tenant_id, p_product_id, -p_quantity, 'out', 'sale',
      COALESCE('Venda durante o serviço ' || v_service_name, 'Venda durante atendimento'),
      v_profile_id
    );

    UPDATE public.products SET quantity = quantity - p_quantity
    WHERE id = p_product_id;

    v_description := 'Venda de ' || v_product_name || ' (' || p_quantity || ' un.)';
    IF v_service_name IS NOT NULL THEN
      v_description := v_description || ' · Serviço: ' || v_service_name;
    END IF;
    IF v_client_name IS NOT NULL THEN
      v_description := v_description || ' · Cliente: ' || v_client_name;
    END IF;

    INSERT INTO public.financial_transactions (
      tenant_id, type, category, amount, description, transaction_date, product_id, appointment_id
    ) VALUES (
      v_tenant_id, 'income', 'Venda de Produto', v_sale_amount, v_description,
      CURRENT_DATE, p_product_id, p_appointment_id
    );
  END IF;

  UPDATE public.appointments SET status = 'completed' WHERE id = p_appointment_id;

  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT full_name INTO v_professional_name FROM public.profiles WHERE id = v_appointment.professional_id LIMIT 1;
  END IF;

  -- Comissão: appointment.commission_amount OU professional_commissions (Equipe)
  IF v_appointment.professional_id IS NOT NULL AND v_appointment.tenant_id IS NOT NULL THEN
    -- Obter auth user id do profissional
    SELECT user_id INTO v_professional_user_id
    FROM public.profiles
    WHERE id = v_appointment.professional_id
    LIMIT 1;

    IF v_professional_user_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.commission_payments WHERE appointment_id = p_appointment_id
      ) THEN
        -- Lookup direto por user_id e tenant_id (sem JOIN com profiles)
        SELECT pc.* INTO v_commission_config
        FROM public.professional_commissions pc
        WHERE pc.user_id = v_professional_user_id
          AND pc.tenant_id = v_appointment.tenant_id
        LIMIT 1;

        IF v_appointment.commission_amount IS NOT NULL AND v_appointment.commission_amount > 0 THEN
          v_commission_amount := v_appointment.commission_amount;
        ELSIF v_commission_config IS NOT NULL THEN
          IF v_commission_config.type = 'percentage' THEN
            v_commission_amount := COALESCE(v_appointment.effective_price, v_appointment.price, 0) * (v_commission_config.value / 100);
          ELSE
            v_commission_amount := v_commission_config.value;
          END IF;
        END IF;

        IF v_commission_amount IS NOT NULL AND v_commission_amount > 0 THEN
          INSERT INTO public.commission_payments (
            tenant_id, professional_id, appointment_id, commission_config_id,
            amount, service_price, commission_type, commission_value, status
          ) VALUES (
            v_appointment.tenant_id, v_professional_user_id, p_appointment_id,
            (SELECT id FROM public.professional_commissions WHERE user_id = v_professional_user_id AND tenant_id = v_appointment.tenant_id LIMIT 1),
            v_commission_amount, COALESCE(v_appointment.effective_price, v_appointment.price, 0),
            CASE WHEN v_appointment.commission_amount IS NOT NULL THEN 'fixed'
                 WHEN v_commission_config.type IN ('percentage','fixed') THEN v_commission_config.type
                 ELSE 'fixed' END,
            COALESCE(v_appointment.commission_amount, v_commission_config.value),
            'pending'
          );
        END IF;
      END IF;
    END IF;
  END IF;

  v_service_profit := COALESCE(v_appointment.effective_price, v_appointment.price, 0) - COALESCE(v_commission_amount, 0);
  v_total_profit := v_service_profit + v_product_profit;
  v_result := jsonb_build_object(
    'commission_amount', (COALESCE(v_commission_amount, 0))::float,
    'service_price', (COALESCE(v_appointment.effective_price, v_appointment.price, 0))::float,
    'service_name', COALESCE(v_appointment.service_name, 'Serviço'),
    'professional_name', COALESCE(v_professional_name, ''),
    'service_profit', (v_service_profit)::float,
    'product_sales', v_product_sales,
    'product_profit_total', (v_product_profit)::float,
    'total_profit', (v_total_profit)::float
  );

  INSERT INTO public.appointment_completion_summaries (
    tenant_id, appointment_id, professional_name, service_name,
    service_profit, product_sales, product_profit_total, total_profit
  ) VALUES (
    v_appointment.tenant_id, p_appointment_id, COALESCE(v_professional_name, ''),
    COALESCE(v_appointment.service_name, 'Serviço'),
    v_service_profit, v_product_sales, v_product_profit, v_total_profit
  );

  RETURN v_result;
END;
$$;
