-- RPC: Concluir agendamento (com ou sem venda de produto)
-- Permite que staff conclua seus próprios agendamentos e registre vendas
-- Executa com SECURITY DEFINER para bypassar RLS em financial_transactions e products

CREATE OR REPLACE FUNCTION public.complete_appointment_with_sale(
  p_appointment_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_quantity INT DEFAULT NULL
)
RETURNS VOID
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

    -- Inserir movimentação de estoque
    INSERT INTO public.stock_movements (
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) VALUES (
      v_tenant_id, p_product_id, -p_quantity, 'out', 'sale',
      COALESCE('Venda durante o serviço ' || v_service_name, 'Venda durante atendimento'),
      v_profile_id
    );

    -- Atualizar quantidade do produto
    UPDATE public.products SET quantity = quantity - p_quantity
    WHERE id = p_product_id;

    -- Montar descrição da transação
    v_description := 'Venda de ' || v_product_name || ' (' || p_quantity || ' un.)';
    IF v_service_name IS NOT NULL THEN
      v_description := v_description || ' · Serviço: ' || v_service_name;
    END IF;
    IF v_client_name IS NOT NULL THEN
      v_description := v_description || ' · Cliente: ' || v_client_name;
    END IF;

    -- Inserir transação financeira
    INSERT INTO public.financial_transactions (
      tenant_id, type, category, amount, description, transaction_date, product_id, appointment_id
    ) VALUES (
      v_tenant_id, 'income', 'Venda de Produto', v_sale_amount, v_description,
      CURRENT_DATE, p_product_id, p_appointment_id
    );
  END IF;

  -- Atualizar status do agendamento
  UPDATE public.appointments SET status = 'completed' WHERE id = p_appointment_id;
END;
$$;

COMMENT ON FUNCTION public.complete_appointment_with_sale IS 'Conclui agendamento. Staff pode concluir seus próprios agendamentos e registrar vendas de produto.';
