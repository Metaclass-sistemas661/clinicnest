-- ============================================================================
-- FIX: Corrigir referências service_id/client_id nas funções financeiras
-- ============================================================================
-- Após as migrações de renomeação:
--   clients → patients (client_id → patient_id)  
--   services → procedures (service_id → procedure_id)
-- As funções complete_appointment_with_sale e register_appointment_payment
-- ainda referenciavam os nomes antigos, causando erro:
--   column "a.service_id" does not exist (42703)
-- ============================================================================

-- ─── 1. Corrigir complete_appointment_with_sale ─────────────────────────────

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
  v_service_price NUMERIC := 0;
  v_product_revenue NUMERIC := 0;
  v_product_cost NUMERIC := 0;
  v_product_profit NUMERIC := 0;
  v_product_sales JSONB := '[]'::jsonb;
  v_description TEXT;
  v_already_completed BOOLEAN := FALSE;
  v_tx_date DATE;
BEGIN
  -- Validações básicas
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NOT NULL AND p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade de produto não pode ser negativa';
  END IF;

  IF p_product_id IS NOT NULL AND (p_quantity IS NULL OR p_quantity <= 0) THEN
    RAISE EXCEPTION 'Quantidade de produto deve ser maior que zero quando houver produto';
  END IF;

  -- Lock para evitar concorrência
  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('complete_appointment_with_sale'));

  -- Buscar agendamento (CORRIGIDO: procedure_id, patients, patient_id)
  SELECT
    a.*,
    s.name AS service_name,
    c.name AS client_name,
    COALESCE(a.price, s.price, 0)::numeric AS effective_price
  INTO v_appointment
  FROM public.appointments a
  LEFT JOIN public.procedures s ON s.id = a.procedure_id
  LEFT JOIN public.patients c ON c.id = a.patient_id
  WHERE a.id = p_appointment_id
  FOR UPDATE OF a;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  v_tenant_id := v_appointment.tenant_id;

  -- Verificar permissões
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

  -- Buscar dados do profissional
  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.user_id, p.full_name
    INTO v_professional_user_id, v_professional_name
    FROM public.profiles p
    WHERE p.id = v_appointment.professional_id
      AND p.tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  -- Se já estava concluído, retornar dados existentes
  IF v_already_completed THEN
    v_service_price := COALESCE(v_appointment.effective_price, 0);

    SELECT s.product_sales, s.product_profit_total
    INTO v_product_sales, v_product_profit
    FROM public.appointment_completion_summaries s
    WHERE s.appointment_id = p_appointment_id
    LIMIT 1;

    RETURN jsonb_build_object(
      'already_completed', true,
      'service_price', (v_service_price)::float,
      'service_name', COALESCE(v_appointment.service_name, 'Procedimento'),
      'professional_name', COALESCE(v_professional_name, ''),
      'product_sales', COALESCE(v_product_sales, '[]'::jsonb),
      'product_profit_total', (COALESCE(v_product_profit, 0))::float,
      'message', 'Atendimento já estava concluído. Use "Registrar Pagamento" para gerar receita.'
    );
  END IF;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_service_price := COALESCE(v_appointment.effective_price, 0);

  -- Processar venda de produto (se houver)
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

    -- Registrar saída de estoque
    INSERT INTO public.stock_movements (
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) VALUES (
      v_tenant_id, p_product_id, -p_quantity, 'out', 'sale',
      COALESCE('Venda durante o procedimento ' || v_appointment.service_name, 'Venda durante atendimento'),
      v_requester_profile_id
    );

    UPDATE public.products
    SET quantity = quantity - p_quantity
    WHERE id = p_product_id AND tenant_id = v_tenant_id;

    -- Receita de produto é registrada imediatamente (venda à vista)
    v_description := 'Venda de ' || v_product.name || ' (' || p_quantity || ' un.)';
    IF v_appointment.service_name IS NOT NULL THEN
      v_description := v_description || ' · Procedimento: ' || v_appointment.service_name;
    END IF;
    IF v_appointment.client_name IS NOT NULL THEN
      v_description := v_description || ' · Paciente: ' || v_appointment.client_name;
    END IF;

    INSERT INTO public.financial_transactions (
      tenant_id, type, category, amount, description, transaction_date, product_id, appointment_id
    )
    SELECT v_tenant_id, 'income', 'Venda de Produto', v_product_revenue, v_description, v_tx_date, p_product_id, p_appointment_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.appointment_id = p_appointment_id
        AND ft.product_id = p_product_id
        AND ft.type = 'income'
        AND ft.category = 'Venda de Produto'
    );
  END IF;

  -- Atualizar status do agendamento
  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id
    AND status <> 'completed';

  -- Criar registro de resumo (sem comissão)
  INSERT INTO public.appointment_completion_summaries (
    tenant_id, appointment_id, professional_name, service_name,
    service_profit, product_sales, product_profit_total, total_profit
  )
  SELECT
    v_tenant_id, p_appointment_id,
    COALESCE(v_professional_name, ''),
    COALESCE(v_appointment.service_name, 'Procedimento'),
    v_service_price,
    v_product_sales,
    v_product_profit,
    v_service_price + v_product_profit
  WHERE NOT EXISTS (
    SELECT 1 FROM public.appointment_completion_summaries s
    WHERE s.appointment_id = p_appointment_id
  );

  RETURN jsonb_build_object(
    'already_completed', false,
    'service_price', (v_service_price)::float,
    'service_name', COALESCE(v_appointment.service_name, 'Procedimento'),
    'professional_name', COALESCE(v_professional_name, ''),
    'product_sales', v_product_sales,
    'product_profit_total', (v_product_profit)::float,
    'total_value', (v_service_price + v_product_revenue)::float,
    'message', 'Atendimento concluído. Registre o pagamento para gerar a receita.',
    'requires_payment', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO service_role;

-- ─── 2. Corrigir register_appointment_payment ───────────────────────────────

CREATE OR REPLACE FUNCTION public.register_appointment_payment(
  p_appointment_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'Dinheiro',
  p_payment_source TEXT DEFAULT 'particular',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_tenant_id UUID;
  v_appointment RECORD;
  v_receivable_id UUID;
  v_transaction_id UUID;
  v_tx_date DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero';
  END IF;

  -- Buscar agendamento (CORRIGIDO: procedure_id, patients, patient_id)
  SELECT
    a.*,
    s.name AS service_name,
    c.name AS client_name,
    COALESCE(a.price, s.price, 0)::numeric AS effective_price
  INTO v_appointment
  FROM public.appointments a
  LEFT JOIN public.procedures s ON s.id = a.procedure_id
  LEFT JOIN public.patients c ON c.id = a.patient_id
  WHERE a.id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_appointment.status <> 'completed' THEN
    RAISE EXCEPTION 'Agendamento deve estar concluído para registrar pagamento';
  END IF;

  v_tenant_id := v_appointment.tenant_id;

  -- Verificar permissões (admin do tenant)
  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar pagamentos';
  END IF;

  -- Buscar profile_id
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id AND tenant_id = v_tenant_id
  LIMIT 1;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  -- Verificar se já existe pagamento para este atendimento
  IF EXISTS (
    SELECT 1 FROM public.accounts_receivable
    WHERE appointment_id = p_appointment_id AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Este atendimento já possui pagamento registrado';
  END IF;

  -- Criar registro em accounts_receivable (client_id mantido se coluna existir)
  INSERT INTO public.accounts_receivable (
    tenant_id, appointment_id, client_id, professional_id,
    service_price, amount_due, amount_paid,
    payment_source, payment_method, status, paid_at,
    description, notes, created_by
  ) VALUES (
    v_tenant_id,
    p_appointment_id,
    v_appointment.patient_id,
    v_appointment.professional_id,
    v_appointment.effective_price,
    v_appointment.effective_price,
    p_amount,
    p_payment_source::public.payment_source,
    p_payment_method,
    CASE WHEN p_amount >= v_appointment.effective_price THEN 'paid' ELSE 'partial' END,
    now(),
    'Pagamento: ' || COALESCE(v_appointment.service_name, 'Procedimento') || ' - ' || COALESCE(v_appointment.client_name, 'Paciente'),
    p_notes,
    v_profile_id
  )
  RETURNING id INTO v_receivable_id;

  -- Criar transação financeira (receita)
  INSERT INTO public.financial_transactions (
    tenant_id, appointment_id, type, category, amount, description, transaction_date
  ) VALUES (
    v_tenant_id,
    p_appointment_id,
    'income',
    'Serviço',
    p_amount,
    'Pagamento recebido: ' || COALESCE(v_appointment.service_name, 'Procedimento') || ' - ' || COALESCE(v_appointment.client_name, 'Paciente'),
    v_tx_date
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'receivable_id', v_receivable_id,
    'transaction_id', v_transaction_id,
    'amount_paid', p_amount,
    'service_price', v_appointment.effective_price,
    'message', 'Pagamento registrado com sucesso'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_appointment_payment(uuid, numeric, text, text, text) TO authenticated;

-- ─── 3. Renomear client_id → patient_id em accounts_receivable (se existir) ─

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'accounts_receivable' 
      AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.accounts_receivable RENAME COLUMN client_id TO patient_id;
  END IF;
END $$;
