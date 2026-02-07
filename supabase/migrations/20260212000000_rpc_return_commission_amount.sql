-- Migration: RPC retorna valor da comissão criada para exibir no modal de sucesso
-- Evita fetch separado e problemas de timing/replicação
-- É necessário DROP pois PostgreSQL não permite alterar o tipo de retorno de função existente

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
  v_description TEXT;
  -- Comissão
  v_professional_user_id UUID;
  v_commission_config RECORD;
  v_commission_amount DECIMAL(10,2);
  v_tenant_default_pct DECIMAL(5,2) := 0;
  v_result JSONB := NULL;
BEGIN
  -- Obter tenant e profile do usuário atual
  SELECT tenant_id, id INTO v_tenant_id, v_profile_id
  FROM public.profiles WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  v_is_admin := public.is_tenant_admin(auth.uid(), v_tenant_id);

  -- Buscar agendamento
  SELECT a.*, s.name as service_name, c.name as client_name
  INTO v_appointment
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = p_appointment_id AND a.tenant_id = v_tenant_id;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  -- Verificar permissão: admin ou profissional do agendamento
  IF NOT v_is_admin AND v_appointment.professional_id IS DISTINCT FROM v_profile_id THEN
    RAISE EXCEPTION 'Sem permissão para concluir este agendamento';
  END IF;

  -- Se houver venda de produto
  IF p_product_id IS NOT NULL AND p_quantity IS NOT NULL AND p_quantity > 0 THEN
    SELECT * INTO v_product FROM public.products
    WHERE id = p_product_id AND tenant_id = v_tenant_id;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;

    IF v_product.quantity < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto selecionado.';
    END IF;

    v_sale_amount := COALESCE(v_product.cost, 0) * p_quantity;
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

  -- Criar comissão e preparar retorno
  IF v_appointment.professional_id IS NOT NULL AND v_appointment.tenant_id IS NOT NULL THEN
    SELECT user_id INTO v_professional_user_id
    FROM public.profiles
    WHERE id = v_appointment.professional_id
    LIMIT 1;

    IF v_professional_user_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.commission_payments WHERE appointment_id = p_appointment_id
      ) THEN
        SELECT * INTO v_commission_config
        FROM public.professional_commissions
        WHERE user_id = v_professional_user_id
        AND tenant_id = v_appointment.tenant_id
        LIMIT 1;

        IF v_appointment.commission_amount IS NOT NULL AND v_appointment.commission_amount > 0 THEN
          v_commission_amount := v_appointment.commission_amount;
        ELSIF v_commission_config IS NOT NULL THEN
          IF v_commission_config.type = 'percentage' THEN
            v_commission_amount := COALESCE(v_appointment.price, 0) * (v_commission_config.value / 100);
          ELSE
            v_commission_amount := v_commission_config.value;
          END IF;
        ELSE
          SELECT COALESCE(default_commission_percent, 0) INTO v_tenant_default_pct
          FROM public.tenants
          WHERE id = v_appointment.tenant_id
          LIMIT 1;
          IF v_tenant_default_pct IS NOT NULL AND v_tenant_default_pct > 0 THEN
            v_commission_amount := COALESCE(v_appointment.price, 0) * (v_tenant_default_pct / 100);
          END IF;
        END IF;

        IF v_commission_amount IS NOT NULL AND v_commission_amount > 0 THEN
          INSERT INTO public.commission_payments (
            tenant_id, professional_id, appointment_id, commission_config_id,
            amount, service_price, commission_type, commission_value, status
          ) VALUES (
            v_appointment.tenant_id, v_professional_user_id, p_appointment_id,
            (SELECT id FROM public.professional_commissions
             WHERE user_id = v_professional_user_id AND tenant_id = v_appointment.tenant_id LIMIT 1),
            v_commission_amount, COALESCE(v_appointment.price, 0),
            CASE WHEN v_appointment.commission_amount IS NOT NULL THEN 'fixed'
                 WHEN v_commission_config IS NOT NULL THEN v_commission_config.type
                 ELSE 'percentage' END,
            COALESCE(v_appointment.commission_amount,
                     CASE WHEN v_commission_config IS NOT NULL THEN v_commission_config.value
                          ELSE v_tenant_default_pct END),
            'pending'
          );
          v_result := jsonb_build_object(
            'commission_amount', (v_commission_amount)::float,
            'service_price', (COALESCE(v_appointment.price, 0))::float
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;
