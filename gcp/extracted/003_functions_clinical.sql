-- GCP Migration: Functions - clinical
-- Total: 88 functions


-- ============================================
-- Function: create_income_on_appointment_completion
-- Source: 20260201202318_6925414d-b7f8-431f-8ffe-99c3bc9b5bed.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_income_on_appointment_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only proceed if status changed to 'completed' and price > 0
    IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.price > 0 THEN
        -- Check if income already exists for this appointment
        IF NOT EXISTS (
            SELECT 1 FROM public.financial_transactions 
            WHERE appointment_id = NEW.id
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
                NEW.id,
                'income',
                'Serviço',
                NEW.price,
                'Agendamento concluído',
                CURRENT_DATE
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


-- ============================================
-- Function: calculate_commission_on_appointment_completed
-- Source: 20260211000000_centralize_commission_in_rpc_only.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Comissão é criada pelo RPC complete_appointment_with_sale, não pelo trigger
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: calculate_commission_on_appointment_insert
-- Source: 20260211000000_centralize_commission_in_rpc_only.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_commission_on_appointment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Comissão é criada pelo RPC complete_appointment_with_sale, não pelo trigger
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: complete_appointment_with_sale
-- Source: 20260703950000_restore_commission_integration.sql
-- ============================================
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

  -- Variáveis de comissão
  v_commission_rule RECORD;
  v_monthly_revenue DECIMAL(10,2) := 0;
  v_commission_amount NUMERIC := 0;
  v_commission_payment_id UUID;
  v_commission_reason TEXT := '';
  v_commission_created BOOLEAN := FALSE;

  v_service_price NUMERIC := 0;
  v_service_profit NUMERIC := 0;
  v_product_revenue NUMERIC := 0;
  v_product_cost NUMERIC := 0;
  v_product_profit NUMERIC := 0;
  v_total_profit NUMERIC := 0;
  v_product_sales JSONB := '[]'::jsonb;
  v_description TEXT;
  v_already_completed BOOLEAN := FALSE;
  v_tx_date DATE;
BEGIN
  -- ───── Validações básicas ─────
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

  -- ───── Buscar agendamento ─────
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

  -- ───── Verificar permissões ─────
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

  -- ───── Buscar dados do profissional ─────
  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.user_id, p.full_name
    INTO v_professional_user_id, v_professional_name
    FROM public.profiles p
    WHERE p.id = v_appointment.professional_id
      AND p.tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  -- ───── Se já estava concluído, retornar dados existentes ─────
  IF v_already_completed THEN
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
      'service_name', COALESCE(v_appointment.service_name, 'Procedimento'),
      'professional_name', COALESCE(v_professional_name, ''),
      'service_profit', (v_service_profit)::float,
      'product_sales', COALESCE(v_product_sales, '[]'::jsonb),
      'product_profit_total', (COALESCE(v_product_profit, 0))::float,
      'total_profit', (COALESCE(v_total_profit, 0))::float,
      'message', 'Atendimento já estava concluído. Use "Registrar Pagamento" para gerar receita.',
      'requires_payment', true
    );
  END IF;

  v_tx_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_service_price := COALESCE(v_appointment.effective_price, 0);

  -- ───── Processar venda de produto (se houver) ─────
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

    -- Receita de produto registrada imediatamente (venda à vista)
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

  -- ───── Atualizar status do agendamento ─────
  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id
    AND status <> 'completed';

  -- ═════════════════════════════════════════════════════════════════════════
  -- CÁLCULO DE COMISSÃO (integrado com commission_rules + fallback legado)
  -- ═════════════════════════════════════════════════════════════════════════
  IF v_professional_user_id IS NULL THEN
    v_commission_reason := 'missing_professional_user_id';
  ELSE
    -- Passo 1: Buscar regra aplicável em commission_rules
    SELECT * INTO v_commission_rule
    FROM public.get_applicable_commission_rule(
      v_tenant_id,
      v_professional_user_id,
      v_appointment.procedure_id,
      v_appointment.insurance_plan_id,
      NULL -- procedure_code (futuro: buscar do procedimento cadastrado)
    );

    -- Passo 2: Fallback para tabela legada professional_commissions
    IF v_commission_rule IS NULL OR v_commission_rule.rule_id IS NULL THEN
      SELECT
        NULL::UUID AS rule_id,
        'default'::public.commission_rule_type AS rule_type,
        CASE WHEN pc.type::text = 'percentage'
             THEN 'percentage'::public.commission_calculation_type
             ELSE 'fixed'::public.commission_calculation_type
        END AS calculation_type,
        pc.value,
        NULL::JSONB AS tier_config,
        FALSE AS is_inverted,
        0 AS priority
      INTO v_commission_rule
      FROM public.professional_commissions pc
      WHERE pc.user_id = v_professional_user_id
        AND pc.tenant_id = v_tenant_id
        AND (pc.payment_type IS NULL OR lower(trim(pc.payment_type)) = 'commission')
      ORDER BY pc.updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;

    -- Passo 3: Calcular comissão
    IF v_commission_rule IS NULL OR v_commission_rule.value IS NULL OR v_commission_rule.value <= 0 THEN
      v_commission_reason := 'missing_config';
    ELSE
      -- Faturamento mensal do profissional (para comissões escalonadas)
      IF v_commission_rule.calculation_type = 'tiered' THEN
        SELECT COALESCE(SUM(cp.service_price), 0)
        INTO v_monthly_revenue
        FROM public.commission_payments cp
        WHERE cp.professional_id = v_professional_user_id
          AND cp.tenant_id = v_tenant_id
          AND date_trunc('month', cp.created_at) = date_trunc('month', now());
      END IF;

      -- Calcular valor da comissão
      v_commission_amount := public.calculate_commission_amount(
        v_commission_rule.calculation_type,
        v_commission_rule.value,
        v_commission_rule.tier_config,
        v_service_price,
        v_monthly_revenue
      );

      -- Override: se o agendamento tem valor manual de comissão, usar ele
      IF v_appointment.commission_amount IS NOT NULL AND v_appointment.commission_amount > 0 THEN
        v_commission_amount := v_appointment.commission_amount;
      END IF;

      IF v_commission_amount <= 0 THEN
        v_commission_reason := 'amount_zero';
      ELSE
        -- Inserir pagamento de comissão (idempotente)
        INSERT INTO public.commission_payments (
          tenant_id, professional_id, appointment_id, commission_config_id,
          amount, service_price, commission_type, commission_value, status, notes
        )
        SELECT
          v_tenant_id,
          v_professional_user_id,
          p_appointment_id,
          v_commission_rule.rule_id,
          CASE WHEN v_commission_rule.is_inverted THEN -v_commission_amount ELSE v_commission_amount END,
          v_service_price,
          CASE
            WHEN v_commission_rule.calculation_type = 'percentage' THEN 'percentage'::public.commission_type
            ELSE 'fixed'::public.commission_type
          END,
          v_commission_rule.value,
          'pending',
          'Comissão por ' || COALESCE(v_appointment.service_name, 'procedimento')
            || CASE WHEN v_commission_rule.rule_type != 'default'
                    THEN ' (regra: ' || v_commission_rule.rule_type::text || ')'
                    ELSE '' END
        WHERE NOT EXISTS (
          SELECT 1 FROM public.commission_payments cp
          WHERE cp.appointment_id = p_appointment_id
        )
        RETURNING id INTO v_commission_payment_id;

        IF v_commission_payment_id IS NULL THEN
          -- Já existe comissão para este agendamento
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

  -- ───── Calcular lucro ─────
  v_service_profit := v_service_price - COALESCE(v_commission_amount, 0);
  v_total_profit := v_service_profit + v_product_profit;

  -- ───── Criar registro de resumo (idempotente) ─────
  INSERT INTO public.appointment_completion_summaries (
    tenant_id, appointment_id, professional_name, service_name,
    service_profit, product_sales, product_profit_total, total_profit
  )
  SELECT
    v_tenant_id, p_appointment_id,
    COALESCE(v_professional_name, ''),
    COALESCE(v_appointment.service_name, 'Procedimento'),
    v_service_profit,
    v_product_sales,
    v_product_profit,
    v_total_profit
  WHERE NOT EXISTS (
    SELECT 1 FROM public.appointment_completion_summaries s
    WHERE s.appointment_id = p_appointment_id
  );

  -- ───── Retorno ─────
  RETURN jsonb_build_object(
    'already_completed', false,
    'commission_amount', (COALESCE(v_commission_amount, 0))::float,
    'commission_created', v_commission_created,
    'commission_reason', v_commission_reason,
    'commission_payment_id', v_commission_payment_id,
    'commission_rule_id', CASE WHEN v_commission_rule IS NOT NULL THEN v_commission_rule.rule_id ELSE NULL END,
    'commission_rule_type', CASE WHEN v_commission_rule IS NOT NULL THEN v_commission_rule.rule_type::text ELSE NULL END,
    'service_price', (v_service_price)::float,
    'service_name', COALESCE(v_appointment.service_name, 'Procedimento'),
    'professional_name', COALESCE(v_professional_name, ''),
    'service_profit', (v_service_profit)::float,
    'product_sales', v_product_sales,
    'product_profit_total', (v_product_profit)::float,
    'total_profit', (COALESCE(v_total_profit, 0))::float,
    'message', 'Atendimento concluído. Registre o pagamento para gerar a receita.',
    'requires_payment', true
  );
END;
$$;


-- ============================================
-- Function: tenant_appointment_history_cutoff
-- Source: 20260215161000_appointments_history_retention.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_appointment_history_cutoff(p_tenant_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tier AS (
    SELECT CASE
      WHEN s.plan IS NULL THEN 'basic'
      WHEN lower(s.plan) IN ('monthly','quarterly','annual') THEN 'basic'
      WHEN split_part(lower(s.plan), '_', 1) IN ('basic','pro','premium') THEN split_part(lower(s.plan), '_', 1)
      ELSE 'basic'
    END AS tier
    FROM public.subscriptions s
    WHERE s.tenant_id = p_tenant_id
    LIMIT 1
  )
  SELECT CASE
    WHEN (SELECT tier FROM tier) = 'basic' THEN now() - interval '6 months'
    WHEN (SELECT tier FROM tier) = 'pro' THEN now() - interval '24 months'
    WHEN (SELECT tier FROM tier) = 'premium' THEN NULL
    ELSE now() - interval '6 months'
  END;
$$;


-- ============================================
-- Function: prevent_cancel_completed_appointments
-- Source: 20260216142000_phase3_cancel_appointment_rules.sql
-- ============================================
create or replace function public.prevent_cancel_completed_appointments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'completed' and new.status = 'cancelled' then
    raise exception 'Não é permitido cancelar um agendamento concluído';
  end if;
  return new;
end;
$$;


-- ============================================
-- Function: cancel_appointment
-- Source: 20260310120000_audit_existing_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_apt public.appointments%rowtype;
  v_is_admin boolean;
  v_already_cancelled boolean := false;
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

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('cancel_appointment'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido cancelar um agendamento concluído';
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este agendamento';
  END IF;

  IF v_apt.status = 'cancelled' THEN
    v_already_cancelled := true;
  ELSE
    UPDATE public.appointments
      SET status = 'cancelled',
          updated_at = now(),
          notes = CASE
            WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN notes
            ELSE COALESCE(notes, '') || '\nCancelamento: ' || p_reason
          END
    WHERE id = v_apt.id
      AND tenant_id = v_profile.tenant_id;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_cancelled',
    'appointment',
    v_apt.id::text,
    jsonb_build_object(
      'already_cancelled', v_already_cancelled,
      'reason', NULLIF(p_reason, ''),
      'was_admin', v_is_admin
    )
  );

  RETURN jsonb_build_object('success', true, 'already_cancelled', v_already_cancelled, 'appointment_id', v_apt.id);
END;
$$;


-- ============================================
-- Function: create_order_for_appointment_v1
-- Source: 20260218200000_orders_checkout_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_order_for_appointment_v1(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_apt       public.appointments%rowtype;
  v_order_id  uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  SELECT * INTO v_apt
  FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  IF v_apt.status = 'cancelled' THEN
    RAISE EXCEPTION 'Agendamento cancelado não pode ter comanda' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Agendamento já concluído' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  -- Uniqueness enforced by DB constraint, but give a friendly message
  IF EXISTS (
    SELECT 1 FROM public.orders WHERE tenant_id = v_profile.tenant_id AND appointment_id = p_appointment_id
  ) THEN
    RAISE EXCEPTION 'Este agendamento já possui uma comanda' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.orders (
    tenant_id, appointment_id, client_id, professional_id,
    status, created_by
  ) VALUES (
    v_profile.tenant_id, v_apt.id, v_apt.client_id, v_apt.professional_id,
    'open', v_user_id
  )
  RETURNING id INTO v_order_id;

  -- If appointment has a service, auto-add as first item
  IF v_apt.service_id IS NOT NULL THEN
    INSERT INTO public.order_items (
      tenant_id, order_id, kind, service_id, professional_id,
      quantity, unit_price, total_price
    ) VALUES (
      v_profile.tenant_id, v_order_id, 'service', v_apt.service_id, v_apt.professional_id,
      1, v_apt.price, v_apt.price
    );

    UPDATE public.orders
    SET subtotal_amount = v_apt.price,
        total_amount = v_apt.price,
        updated_at = now()
    WHERE id = v_order_id;
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id, v_user_id,
    'order_created_from_appointment', 'order', v_order_id::text,
    jsonb_build_object('appointment_id', p_appointment_id)
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;


-- ============================================
-- Function: get_dashboard_clients_count
-- Source: 20260230000000_add_dashboard_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_clients_count(
  p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Segurança: chamador deve pertencer ao tenant
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.tenant_id = p_tenant_id AND p.user_id = auth.uid()
  ) THEN
    RETURN 0;
  END IF;

  -- Contar clientes únicos do tenant (garantir filtro correto)
  SELECT COUNT(id)
  INTO v_count
  FROM clients
  WHERE tenant_id = p_tenant_id;

  RETURN COALESCE(v_count, 0)::INTEGER;
END;
$$;


-- ============================================
-- Function: auto_add_to_queue_on_checkin
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_add_to_queue_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auto_queue BOOLEAN;
  v_already_in_queue BOOLEAN;
  v_priority INTEGER;
  v_priority_label TEXT;
  v_call_id UUID;
BEGIN
  -- Só processa se mudou para 'arrived'
  IF NEW.status::TEXT != 'arrived' OR (OLD IS NOT NULL AND OLD.status::TEXT = 'arrived') THEN
    RETURN NEW;
  END IF;
  
  -- Verifica flag do tenant
  SELECT auto_queue_on_checkin INTO v_auto_queue
  FROM tenants WHERE id = NEW.tenant_id;
  
  IF NOT COALESCE(v_auto_queue, true) THEN
    RETURN NEW;
  END IF;
  
  -- Verifica duplicata
  SELECT EXISTS(
    SELECT 1 FROM patient_calls
    WHERE tenant_id = NEW.tenant_id
      AND patient_id = NEW.patient_id
      AND created_at::DATE = CURRENT_DATE
      AND status IN ('waiting', 'calling', 'in_service')
  ) INTO v_already_in_queue;
  
  IF v_already_in_queue THEN
    RETURN NEW;
  END IF;
  
  -- Prioridade (protegido)
  BEGIN
    SELECT gpp.priority, gpp.priority_label INTO v_priority, v_priority_label
    FROM get_patient_priority(NEW.patient_id) gpp;
  EXCEPTION WHEN OTHERS THEN
    v_priority := 5;
    v_priority_label := 'Normal';
  END;
  
  -- Adiciona à fila (CRÍTICO)
  SELECT add_patient_to_queue(
    NEW.tenant_id,
    NEW.patient_id,
    NEW.id,
    NULL,
    NEW.room_id,
    NEW.professional_id,
    COALESCE(v_priority, 5),
    v_priority_label
  ) INTO v_call_id;
  
  -- Notificação (protegida — falha NÃO impede entrada na fila)
  IF NEW.professional_id IS NOT NULL AND v_call_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, metadata)
      SELECT 
        p.user_id, NEW.tenant_id, 'paciente_chegou', 'Paciente Chegou',
        c.name || ' fez check-in e está aguardando',
        jsonb_build_object(
          'patient_id', NEW.patient_id,
          'patient_name', c.name,
          'appointment_id', NEW.id,
          'call_id', v_call_id,
          'priority', v_priority,
          'priority_label', v_priority_label
        )
      FROM profiles p
      JOIN patients c ON c.id = NEW.patient_id
      WHERE p.id = NEW.professional_id AND p.user_id IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_add_to_queue_on_checkin: notify failed for apt % - %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: create_appointment_v2
-- Source: 20260627200000_appointment_rpcs_add_booked_by.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_appointment_v2(
  p_scheduled_at timestamptz,
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_status public.appointment_status DEFAULT 'pending',
  p_notes text DEFAULT NULL,
  p_telemedicine boolean DEFAULT FALSE,
  p_booked_by_id uuid DEFAULT NULL
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
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at é obrigatório';
  END IF;

  v_duration := COALESCE(p_duration_minutes, 30);
  IF v_duration <= 0 OR v_duration > 24*60 THEN
    RAISE EXCEPTION 'duration_minutes inválido';
  END IF;

  v_price := COALESCE(p_price, 0);
  IF v_price < 0 THEN
    RAISE EXCEPTION 'price não pode ser negativo';
  END IF;

  IF p_status IS NULL THEN
    p_status := 'pending';
  END IF;

  IF p_status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Status inicial inválido';
  END IF;

  IF v_is_admin THEN
    v_professional_id := COALESCE(p_professional_profile_id, v_profile.id);
  ELSE
    v_professional_id := v_profile.id;
  END IF;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'professional_id é obrigatório';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant';
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
    RAISE EXCEPTION 'Conflito de horário' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    patient_id,
    procedure_id,
    professional_id,
    scheduled_at,
    duration_minutes,
    status,
    price,
    notes,
    telemedicine,
    booked_by_id
  ) VALUES (
    v_profile.tenant_id,
    p_client_id,
    p_service_id,
    v_professional_id,
    p_scheduled_at,
    v_duration,
    p_status,
    v_price,
    NULLIF(p_notes, ''),
    COALESCE(p_telemedicine, FALSE),
    p_booked_by_id
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
      'professional_id', v_professional_id,
      'service_id', p_service_id,
      'client_id', p_client_id,
      'telemedicine', COALESCE(p_telemedicine, FALSE),
      'booked_by_id', p_booked_by_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'status', p_status
  );
END;
$$;


-- ============================================
-- Function: update_appointment_v2
-- Source: 20260627200000_appointment_rpcs_add_booked_by.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_appointment_v2(
  p_appointment_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_professional_profile_id uuid DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_telemedicine boolean DEFAULT NULL,
  p_booked_by_id uuid DEFAULT NULL
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
  v_new_telemedicine boolean;
  v_end_at timestamptz;
  v_lock_key text;
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

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('update_appointment_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para editar este agendamento';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido editar um agendamento concluído';
  END IF;

  v_new_telemedicine := COALESCE(p_telemedicine, v_apt.telemedicine);

  IF v_apt.status = 'confirmed' THEN
    UPDATE public.appointments
    SET notes = NULLIF(p_notes, ''),
        telemedicine = v_new_telemedicine,
        booked_by_id = COALESCE(p_booked_by_id, booked_by_id),
        updated_at = now()
    WHERE id = v_apt.id
      AND tenant_id = v_profile.tenant_id;


    PERFORM public.log_tenant_action(
      v_profile.tenant_id,
      v_user_id,
      'appointment_notes_updated',
      'appointment',
      v_apt.id::text,
      jsonb_build_object('notes_only', true, 'telemedicine', v_new_telemedicine)
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
    RAISE EXCEPTION 'duration_minutes inválido';
  END IF;

  IF v_new_price < 0 THEN
    RAISE EXCEPTION 'price não pode ser negativo';
  END IF;

  IF v_new_professional_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_new_professional_id
      AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant';
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
    RAISE EXCEPTION 'Conflito de horário' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.appointments
  SET patient_id = p_client_id,
      procedure_id = p_service_id,
      professional_id = v_new_professional_id,
      scheduled_at = v_new_scheduled_at,
      duration_minutes = v_new_duration,
      price = v_new_price,
      notes = NULLIF(p_notes, ''),
      telemedicine = v_new_telemedicine,
      telemedicine_url = CASE WHEN v_new_telemedicine THEN telemedicine_url ELSE NULL END,
      booked_by_id = COALESCE(p_booked_by_id, booked_by_id),
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
      'professional_id', v_new_professional_id,
      'telemedicine', v_new_telemedicine,
      'booked_by_id', p_booked_by_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_apt.id
  );
END;
$$;


-- ============================================
-- Function: set_appointment_status_v2
-- Source: 20260310100000_enterprise_agenda_finance_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_appointment_status_v2(
  p_appointment_id uuid,
  p_status public.appointment_status
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
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  IF p_status IS NULL THEN
    RAISE EXCEPTION 'status é obrigatório';
  END IF;

  IF p_status = 'cancelled' THEN
    -- Reuse existing cancel RPC (idempotent + completed protection)
    RETURN public.cancel_appointment(p_appointment_id, NULL);
  END IF;

  IF p_status = 'completed' THEN
    RAISE EXCEPTION 'Use complete_appointment_with_sale para concluir agendamentos';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('set_appointment_status_v2'));

  SELECT * INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.tenant_id = v_profile.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF NOT v_is_admin AND v_apt.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para alterar status deste agendamento';
  END IF;

  IF v_apt.status = 'completed' THEN
    RAISE EXCEPTION 'Não é permitido alterar status de agendamento concluído';
  END IF;

  -- Allowed transitions
  IF p_status = 'confirmed' AND v_apt.status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Transição de status inválida';
  END IF;

  IF p_status = v_apt.status THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true, 'appointment_id', v_apt.id, 'status', v_apt.status);
  END IF;

  UPDATE public.appointments
  SET status = p_status,
      updated_at = now()
  WHERE id = v_apt.id
    AND tenant_id = v_profile.tenant_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'appointment_status_changed',
    'appointment',
    v_apt.id::text,
    jsonb_build_object('from', v_apt.status, 'to', p_status)
  );

  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt.id, 'status', p_status);
END;
$$;


-- ============================================
-- Function: delete_appointment_v2
-- Source: 20260310131000_rpcs_error_codes_and_product_create.sql
-- ============================================
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


-- ============================================
-- Function: audit_appointment_completion_summary_insert
-- Source: 20260310121000_audit_appointment_completion.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_appointment_completion_summary_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
BEGIN
  PERFORM public.log_tenant_action(
    NEW.tenant_id,
    COALESCE(v_actor_user_id, NULL),
    'appointment_completed',
    'appointment',
    COALESCE(NEW.appointment_id::text, NULL),
    jsonb_build_object(
      'summary_id', NEW.id::text,
      'service_name', NEW.service_name,
      'professional_name', NEW.professional_name,
      'service_profit', NEW.service_profit,
      'product_profit_total', NEW.product_profit_total,
      'total_profit', NEW.total_profit
    )
  );

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: create_schedule_block_v1
-- Source: 20260311000000_agenda_availability_blocks_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_schedule_block_v1(
  p_professional_id uuid DEFAULT NULL,
  p_start_at timestamptz DEFAULT NULL,
  p_end_at timestamptz DEFAULT NULL,
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
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  -- Staff can only create blocks for themselves
  IF NOT v_is_admin AND p_professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para criar bloqueio para outro profissional' USING DETAIL = 'FORBIDDEN';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Período inválido' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  IF p_professional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id AND p.tenant_id = v_profile.tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional inválido para o tenant' USING DETAIL = 'VALIDATION_ERROR';
  END IF;

  INSERT INTO public.schedule_blocks (
    tenant_id, professional_id, start_at, end_at, reason, created_by
  ) VALUES (
    v_profile.tenant_id, p_professional_id, p_start_at, p_end_at, NULLIF(p_reason, ''), v_user_id
  )
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'schedule_block_created',
    'schedule_block',
    v_id::text,
    jsonb_build_object(
      'professional_id', p_professional_id,
      'start_at', p_start_at,
      'end_at', p_end_at,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'block_id', v_id);
END;
$$;


-- ============================================
-- Function: delete_schedule_block_v1
-- Source: 20260311000000_agenda_availability_blocks_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_schedule_block_v1(
  p_block_id uuid
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
  v_block public.schedule_blocks%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';
  END IF;

  v_is_admin := public.is_tenant_admin(v_user_id, v_profile.tenant_id);

  SELECT * INTO v_block
  FROM public.schedule_blocks
  WHERE id = p_block_id AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bloqueio não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;

  IF NOT v_is_admin AND v_block.professional_id IS DISTINCT FROM v_profile.id THEN
    RAISE EXCEPTION 'Sem permissão para remover este bloqueio' USING DETAIL = 'FORBIDDEN';
  END IF;

  DELETE FROM public.schedule_blocks WHERE id = p_block_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'schedule_block_deleted',
    'schedule_block',
    p_block_id::text,
    jsonb_build_object('professional_id', v_block.professional_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================
-- Function: is_slot_within_working_hours_v1
-- Source: 20260311000000_agenda_availability_blocks_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.is_slot_within_working_hours_v1(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow smallint;
  v_has_config boolean;
  v_row record;
  v_start_local time;
  v_end_local time;
BEGIN
  v_dow := EXTRACT(DOW FROM p_start_at)::smallint;

  SELECT EXISTS(
    SELECT 1 FROM public.professional_working_hours
    WHERE tenant_id = p_tenant_id
      AND professional_id = p_professional_id
      AND is_active = true
  ) INTO v_has_config;

  -- If no config exists, allow (backward compatible default)
  IF NOT v_has_config THEN
    RETURN true;
  END IF;

  SELECT start_time, end_time
  INTO v_row
  FROM public.professional_working_hours
  WHERE tenant_id = p_tenant_id
    AND professional_id = p_professional_id
    AND day_of_week = v_dow
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_start_local := (p_start_at AT TIME ZONE 'America/Sao_Paulo')::time;
  v_end_local := (p_end_at AT TIME ZONE 'America/Sao_Paulo')::time;

  RETURN (v_start_local >= v_row.start_time) AND (v_end_local <= v_row.end_time);
END;
$$;


-- ============================================
-- Function: create_public_appointment_v1
-- Source: 20260312000000_online_booking_v1.sql
-- ============================================
create or replace function public.create_public_appointment_v1(
  p_tenant_slug text,
  p_service_id uuid,
  p_professional_profile_id uuid,
  p_scheduled_at timestamptz,
  p_client_name text,
  p_client_email text default null,
  p_client_phone text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants%rowtype;
  v_service public.services%rowtype;
  v_prof public.profiles%rowtype;
  v_client_id uuid;
  v_duration integer;
  v_price numeric;
  v_end_at timestamptz;
  v_appointment_id uuid;
  v_token uuid;
  v_min_lead integer;
  v_has_conflict boolean;
  v_blocked boolean;
  v_within boolean;
begin
  if p_tenant_slug is null or btrim(p_tenant_slug) = '' then
    perform public.raise_app_error('VALIDATION_ERROR', 'Slug do salão é obrigatório');
  end if;

  select * into v_tenant
  from public.get_tenant_by_booking_slug_v1(p_tenant_slug);

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Salão não encontrado');
  end if;

  if v_tenant.online_booking_enabled is distinct from true then
    perform public.raise_app_error('BOOKING_DISABLED', 'Agendamento online não está disponível para este salão');
  end if;

  if p_scheduled_at is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'Data/hora do agendamento é obrigatória');
  end if;

  v_min_lead := coalesce(v_tenant.online_booking_min_lead_minutes, 60);
  if p_scheduled_at < now() + make_interval(mins => v_min_lead) then
    perform public.raise_app_error('BOOKING_TOO_SOON', 'Este horário não respeita a antecedência mínima');
  end if;

  select * into v_service
  from public.services s
  where s.id = p_service_id
    and s.tenant_id = v_tenant.id
    and s.is_active = true
  limit 1;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
  end if;

  select * into v_prof
  from public.profiles p
  where p.id = p_professional_profile_id
    and p.tenant_id = v_tenant.id
  limit 1;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Profissional não encontrado');
  end if;

  v_duration := greatest(1, coalesce(v_service.duration_minutes, 45));
  v_price := coalesce(v_service.price, 0);
  v_end_at := p_scheduled_at + make_interval(mins => v_duration);

  -- Working hours validation (Milestone 3)
  v_within := public.is_slot_within_working_hours_v1(v_tenant.id, p_professional_profile_id, p_scheduled_at, v_end_at);
  if v_within is distinct from true then
    perform public.raise_app_error('OUTSIDE_WORKING_HOURS', 'Fora do horário de trabalho configurado para este profissional');
  end if;

  -- Block validation (Milestone 3)
  select exists(
    select 1
    from public.schedule_blocks b
    where b.tenant_id = v_tenant.id
      and (b.professional_id is null or b.professional_id = p_professional_profile_id)
      and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) into v_blocked;

  if v_blocked then
    perform public.raise_app_error('SCHEDULE_BLOCKED', 'Horário bloqueado na agenda');
  end if;

  -- Conflict validation
  select exists(
    select 1
    from public.appointments a
    where a.tenant_id = v_tenant.id
      and a.professional_id = p_professional_profile_id
      and a.status <> 'cancelled'
      and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
          && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) into v_has_conflict;

  if v_has_conflict then
    perform public.raise_app_error('SLOT_CONFLICT', 'Conflito de horário');
  end if;

  if p_client_name is null or btrim(p_client_name) = '' then
    perform public.raise_app_error('VALIDATION_ERROR', 'Nome do cliente é obrigatório');
  end if;

  -- Create a client record for tenant
  insert into public.clients(tenant_id, name, email, phone, notes)
  values (v_tenant.id, btrim(p_client_name), nullif(btrim(p_client_email), ''), nullif(btrim(p_client_phone), ''), null)
  returning id into v_client_id;

  insert into public.appointments(
    tenant_id,
    client_id,
    service_id,
    professional_id,
    scheduled_at,
    duration_minutes,
    status,
    price,
    notes,
    created_via,
    public_booking_client_name,
    public_booking_client_email,
    public_booking_client_phone
  ) values (
    v_tenant.id,
    v_client_id,
    v_service.id,
    v_prof.id,
    p_scheduled_at,
    v_duration,
    'pending',
    v_price,
    nullif(btrim(p_notes), ''),
    'online',
    btrim(p_client_name),
    nullif(btrim(p_client_email), ''),
    nullif(btrim(p_client_phone), '')
  )
  returning id, public_booking_token into v_appointment_id, v_token;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'public_booking_token', v_token,
    'tenant_id', v_tenant.id
  );
end;
$$;


-- ============================================
-- Function: cancel_public_appointment_v1
-- Source: 20260312000000_online_booking_v1.sql
-- ============================================
create or replace function public.cancel_public_appointment_v1(
  p_public_booking_token uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_apt public.appointments%rowtype;
  v_tenant public.tenants%rowtype;
  v_min_lead integer;
  v_cutoff timestamptz;
begin
  if p_public_booking_token is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'Token é obrigatório');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_public_booking_token::text), hashtext('cancel_public_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.public_booking_token = p_public_booking_token
  limit 1
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  select * into v_tenant
  from public.tenants t
  where t.id = v_apt.tenant_id
  limit 1;

  v_min_lead := coalesce(v_tenant.online_booking_cancel_min_lead_minutes, 240);
  v_cutoff := v_apt.scheduled_at - make_interval(mins => v_min_lead);

  if now() > v_cutoff then
    perform public.raise_app_error('BOOKING_CANCEL_TOO_LATE', 'Cancelamento fora do prazo');
  end if;

  if v_apt.status = 'completed' then
    perform public.raise_app_error('APPOINTMENT_DELETE_COMPLETED_FORBIDDEN', 'Não é permitido cancelar um agendamento concluído');
  end if;

  if v_apt.status = 'cancelled' then
    return jsonb_build_object('success', true, 'already_cancelled', true, 'appointment_id', v_apt.id);
  end if;

  update public.appointments
    set status = 'cancelled',
        updated_at = now(),
        notes = case when p_reason is null or btrim(p_reason) = '' then notes else coalesce(notes, '') || '\nCancelamento (online): ' || p_reason end
  where id = v_apt.id;

  return jsonb_build_object('success', true, 'already_cancelled', false, 'appointment_id', v_apt.id);
end;
$$;


-- ============================================
-- Function: consume_package_session_for_appointment_v1
-- Source: 20260312010000_crm_packages_v1.sql
-- ============================================
create or replace function public.consume_package_session_for_appointment_v1(
  p_appointment_id uuid
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
  v_apt public.appointments%rowtype;
  v_pkg public.client_packages%rowtype;
  v_consumption_id uuid;
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

  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('consume_package_session_for_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  if not v_is_admin and v_apt.professional_id is distinct from v_profile.id then
    perform public.raise_app_error('FORBIDDEN', 'Sem permissão');
  end if;

  if v_apt.status <> 'completed' then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'not_completed');
  end if;

  -- idempotency
  if exists (select 1 from public.appointment_package_consumptions c where c.appointment_id = v_apt.id) then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'already_consumed');
  end if;

  if v_apt.client_id is null or v_apt.service_id is null then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'missing_client_or_service');
  end if;

  -- pick package
  select * into v_pkg
  from public.client_packages p
  where p.tenant_id = v_profile.tenant_id
    and p.client_id = v_apt.client_id
    and p.service_id = v_apt.service_id
    and p.status = 'active'
    and p.remaining_sessions > 0
    and (p.expires_at is null or p.expires_at > now())
  order by p.expires_at nulls last, p.purchased_at asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', true, 'consumed', false, 'reason', 'no_package');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_pkg.id::text), hashtext('consume_client_package'));

  insert into public.appointment_package_consumptions(tenant_id, appointment_id, package_id)
  values (v_profile.tenant_id, v_apt.id, v_pkg.id)
  returning id into v_consumption_id;

  insert into public.client_package_ledger(
    tenant_id, package_id, appointment_id, delta_sessions, reason, notes, actor_user_id
  ) values (
    v_profile.tenant_id, v_pkg.id, v_apt.id, -1, 'consume', 'Consumo automático ao concluir atendimento', v_user_id
  );

  update public.client_packages
    set remaining_sessions = remaining_sessions - 1,
        status = case when remaining_sessions - 1 <= 0 then 'depleted' else status end,
        updated_at = now()
  where id = v_pkg.id
    and tenant_id = v_profile.tenant_id
    and remaining_sessions > 0;

  return jsonb_build_object('success', true, 'consumed', true, 'package_id', v_pkg.id);
end;
$$;


-- ============================================
-- Function: get_client_timeline_v1
-- Source: 20260321160000_fix_client_timeline_v1_columns.sql
-- ============================================
create or replace function public.get_client_timeline_v1(
  p_client_id uuid,
  p_limit integer default 50
)
returns table(
  event_at timestamptz,
  kind text,
  title text,
  body text,
  meta jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_admin boolean := false;
  v_limit integer;
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

  -- p_client_id can be either a clients.id or patients.id
  -- Check patients first (primary use case from PacienteDetalhe), then clients
  if not exists (
    select 1 from public.patients pt where pt.id = p_client_id and pt.tenant_id = v_profile.tenant_id
  ) and not exists (
    select 1 from public.clients c where c.id = p_client_id and c.tenant_id = v_profile.tenant_id
  ) then
    perform public.raise_app_error('NOT_FOUND', 'Cliente não encontrado');
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 50), 200));

  return query
  with apt as (
    select
      a.scheduled_at as event_at,
      'appointment'::text as kind,
      coalesce(pr.name, 'Agendamento') as title,
      coalesce('Status: ' || a.status::text, '') as body,
      jsonb_build_object(
        'appointment_id', a.id,
        'status', a.status,
        'procedure_id', a.procedure_id,
        'professional_id', a.professional_id,
        'price', a.price
      ) as meta
    from public.appointments a
    left join public.procedures pr on pr.id = a.procedure_id
    where a.tenant_id = v_profile.tenant_id
      and a.patient_id = p_client_id
  ),
  ord as (
    select
      o.created_at as event_at,
      'order'::text as kind,
      'Comanda'::text as title,
      coalesce('Status: ' || o.status::text, '') as body,
      jsonb_build_object(
        'order_id', o.id,
        'appointment_id', o.appointment_id,
        'total_amount', o.total_amount,
        'status', o.status
      ) as meta
    from public.orders o
    where o.tenant_id = v_profile.tenant_id
      and o.patient_id = p_client_id
  ),
  pay as (
    select
      p.paid_at as event_at,
      'payment'::text as kind,
      'Pagamento'::text as title,
      coalesce(pm.name, 'Pagamento') || ' · ' || p.amount::text as body,
      jsonb_build_object(
        'payment_id', p.id,
        'order_id', p.order_id,
        'amount', p.amount,
        'status', p.status,
        'payment_method', pm.name
      ) as meta
    from public.payments p
    left join public.payment_methods pm on pm.id = p.payment_method_id
    join public.orders o on o.id = p.order_id and o.tenant_id = v_profile.tenant_id
    where o.patient_id = p_client_id
      and p.status = 'paid'
      and p.paid_at is not null
  )
  select * from (
    select * from apt
    union all
    select * from ord
    union all
    select * from pay
  ) x
  order by event_at desc nulls last
  limit v_limit;
end;
$$;


-- ============================================
-- Function: revert_package_consumption_for_appointment_v1
-- Source: 20260312012000_revert_package_consumption_v1.sql
-- ============================================
create or replace function public.revert_package_consumption_for_appointment_v1(
  p_appointment_id uuid,
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
  v_is_admin boolean := false;

  v_consumption public.appointment_package_consumptions%rowtype;
  v_pkg public.client_packages%rowtype;
  v_apt public.appointments%rowtype;
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
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem estornar pacote');
  end if;

  if p_appointment_id is null then
    perform public.raise_app_error('VALIDATION_ERROR', 'appointment_id é obrigatório');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('revert_package_consumption_for_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  select * into v_consumption
  from public.appointment_package_consumptions c
  where c.appointment_id = p_appointment_id
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', true, 'reverted', false, 'reason', 'not_consumed');
  end if;

  select * into v_pkg
  from public.client_packages p
  where p.id = v_consumption.package_id
    and p.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Pacote não encontrado');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_pkg.id::text), hashtext('revert_client_package'));

  delete from public.appointment_package_consumptions
  where appointment_id = p_appointment_id;

  insert into public.client_package_ledger(
    tenant_id, package_id, appointment_id, delta_sessions, reason, notes, actor_user_id
  ) values (
    v_profile.tenant_id,
    v_pkg.id,
    p_appointment_id,
    1,
    'revert',
    coalesce(nullif(btrim(p_reason), ''), 'Estorno manual de consumo do pacote'),
    v_user_id
  );

  update public.client_packages
    set remaining_sessions = remaining_sessions + 1,
        status = 'active',
        updated_at = now()
  where id = v_pkg.id
    and tenant_id = v_profile.tenant_id;

  perform public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'client_package_consumption_reverted',
    'appointment',
    p_appointment_id::text,
    jsonb_build_object(
      'package_id', v_pkg.id,
      'delta_sessions', 1,
      'reason', nullif(btrim(p_reason), '')
    )
  );

  return jsonb_build_object(
    'success', true,
    'reverted', true,
    'package_id', v_pkg.id,
    'appointment_id', p_appointment_id
  );
end;
$$;


-- ============================================
-- Function: apply_cashback_for_appointment_v1
-- Source: 20260312020000_loyalty_cashback_v1.sql
-- ============================================
create or replace function public.apply_cashback_for_appointment_v1(
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_apt public.appointments%rowtype;
  v_tenant public.tenants%rowtype;
  v_amount numeric;
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

  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('apply_cashback_for_appointment_v1'));

  select * into v_apt
  from public.appointments a
  where a.id = p_appointment_id
    and a.tenant_id = v_profile.tenant_id
  for update;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Agendamento não encontrado');
  end if;

  if v_apt.status <> 'completed' then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'not_completed');
  end if;

  if v_apt.client_id is null then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'missing_client');
  end if;

  if exists (
    select 1 from public.appointment_cashback_earnings e
    where e.tenant_id = v_apt.tenant_id
      and e.appointment_id = v_apt.id
  ) then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'already_applied');
  end if;

  select * into v_tenant
  from public.tenants t
  where t.id = v_apt.tenant_id
  limit 1;

  if v_tenant.cashback_enabled is distinct from true then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'disabled');
  end if;

  if coalesce(v_tenant.cashback_percent, 0) <= 0 then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'percent_zero');
  end if;

  v_amount := round(coalesce(v_apt.price, 0) * (v_tenant.cashback_percent / 100), 2);
  if v_amount <= 0 then
    return jsonb_build_object('success', true, 'applied', false, 'reason', 'amount_zero');
  end if;

  insert into public.cashback_wallets(tenant_id, client_id, balance)
  values (v_apt.tenant_id, v_apt.client_id, 0)
  on conflict (tenant_id, client_id) do nothing;

  insert into public.appointment_cashback_earnings(tenant_id, appointment_id, client_id, earned_amount)
  values (v_apt.tenant_id, v_apt.id, v_apt.client_id, v_amount);

  insert into public.cashback_ledger(
    tenant_id, client_id, appointment_id, delta_amount, reason, notes, actor_user_id
  ) values (
    v_apt.tenant_id,
    v_apt.client_id,
    v_apt.id,
    v_amount,
    'earn',
    'Cashback por atendimento concluído',
    v_user_id
  );

  update public.cashback_wallets
    set balance = balance + v_amount,
        updated_at = now()
  where tenant_id = v_apt.tenant_id
    and client_id = v_apt.client_id;

  return jsonb_build_object('success', true, 'applied', true, 'amount', v_amount);
end;
$$;


-- ============================================
-- Function: create_nps_response_for_completed_appointment_v1
-- Source: 20260319000000_automations_whatsapp_nps_phase1_v1.sql
-- ============================================
create or replace function public.create_nps_response_for_completed_appointment_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    insert into public.nps_responses(tenant_id, appointment_id, client_id)
    select new.tenant_id, new.id, new.client_id
    where not exists (
      select 1 from public.nps_responses r
      where r.appointment_id = new.id
    );
  end if;
  return new;
end;
$$;


-- ============================================
-- Function: get_patient_appointments
-- Source: 20260703000000_fix_patient_portal_renames_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_appointments(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      a.id,
      a.tenant_id,
      a.scheduled_at,
      a.duration_minutes,
      a.status,
      a.notes,
      a.telemedicine,
      a.procedure_id,
      a.professional_id,
      c.name AS client_name,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name
    FROM public.appointments a
    JOIN public.patient_profiles pp
      ON pp.tenant_id = a.tenant_id
     AND pp.client_id = a.patient_id
    LEFT JOIN public.patients c ON c.id = a.patient_id
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE pp.user_id = v_user_id
      AND pp.is_active = true
      AND (p_from IS NULL OR a.scheduled_at >= p_from)
      AND (p_to IS NULL OR a.scheduled_at <= p_to)
      AND (p_status IS NULL OR a.status = p_status::public.appointment_status)
    ORDER BY a.scheduled_at DESC
    LIMIT 200
  ) r;

  RETURN v_result;
END;
$$;


-- ============================================
-- Function: get_patient_telemedicine_appointments
-- Source: APLICAR_NO_SUPABASE_SQL_EDITOR.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_telemedicine_appointments(p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid := auth.uid(); v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)),'[]'::jsonb) INTO v_result
  FROM (
    SELECT a.id, a.tenant_id, a.scheduled_at, a.duration_minutes, a.status, s.name AS service_name, p.full_name AS professional_name, t.name AS clinic_name
    FROM public.appointments a
    JOIN public.patient_profiles pp ON pp.tenant_id=a.tenant_id AND pp.client_id=a.patient_id
    LEFT JOIN public.procedures s ON s.id=a.procedure_id
    LEFT JOIN public.profiles p ON p.id=a.professional_id
    LEFT JOIN public.tenants t ON t.id=a.tenant_id
    WHERE pp.user_id=v_user_id AND pp.is_active=true AND a.telemedicine=true AND a.status IN ('pending','confirmed')
      AND a.scheduled_at >= p_date::timestamptz AND a.scheduled_at < (p_date+interval '1 day')::timestamptz
    ORDER BY a.scheduled_at
  ) r;
  RETURN v_result;
END;
$$;


-- ============================================
-- Function: generate_telemedicine_token
-- Source: 20260320100001_telemedicine_public_token_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_telemedicine_token(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_apt record;
  v_token uuid;
BEGIN
  -- Validate caller is staff
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_caller_id LIMIT 1;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'NOT_STAFF';
  END IF;

  -- Validate appointment belongs to caller's tenant and is telemedicine
  SELECT id, tenant_id, telemedicine, telemedicine_token
    INTO v_apt
    FROM public.appointments
    WHERE id = p_appointment_id AND tenant_id = v_profile.tenant_id;

  IF v_apt IS NULL THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  IF v_apt.telemedicine IS NOT TRUE THEN
    RAISE EXCEPTION 'NOT_TELEMEDICINE';
  END IF;

  -- Reuse existing token if present
  IF v_apt.telemedicine_token IS NOT NULL THEN
    RETURN jsonb_build_object(
      'token', v_apt.telemedicine_token,
      'already_existed', true
    );
  END IF;

  -- Generate new token
  v_token := gen_random_uuid();

  UPDATE public.appointments
    SET telemedicine_token = v_token, updated_at = now()
    WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'token', v_token,
    'already_existed', false
  );
END;
$$;


-- ============================================
-- Function: get_appointment_by_telemedicine_token
-- Source: 20260320100001_telemedicine_public_token_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_appointment_by_telemedicine_token(
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'tenant_id', a.tenant_id,
    'scheduled_at', a.scheduled_at,
    'duration_minutes', a.duration_minutes,
    'status', a.status,
    'service_name', COALESCE(s.name, ''),
    'professional_name', COALESCE(p.full_name, ''),
    'clinic_name', COALESCE(t.name, ''),
    'client_name', COALESCE(c.name, '')
  )
  INTO v_result
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  LEFT JOIN public.tenants t ON t.id = a.tenant_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  WHERE a.telemedicine_token = p_token
    AND a.telemedicine = true
    AND a.status IN ('pending', 'confirmed');

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'TOKEN_INVALID_OR_EXPIRED');
  END IF;

  RETURN v_result;
END;
$$;


-- ============================================
-- Function: get_patient_prescriptions
-- Source: 20260703100000_fix_patient_portal_renamed_columns_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_prescriptions(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', p.id,
        'tenant_id', p.tenant_id,
        'prescription_type', p.prescription_type,
        'issued_at', p.issued_at,
        'validity_days', p.validity_days,
        'expires_at', p.expires_at,
        'medications', p.medications,
        'instructions', p.instructions,
        'status', p.status,
        'professional_name', COALESCE(pr.full_name, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.prescriptions p
      LEFT JOIN public.profiles pr ON pr.id = p.professional_id
      LEFT JOIN public.tenants t ON t.id = p.tenant_id
      WHERE p.patient_id = v_link.client_id
        AND p.tenant_id = v_link.tenant_id
      ORDER BY p.issued_at DESC;
  END LOOP;
END;
$$;


-- ============================================
-- Function: get_patient_exam_results
-- Source: 20260703100000_fix_patient_portal_renamed_columns_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_exam_results(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', e.id,
        'tenant_id', e.tenant_id,
        'exam_type', e.exam_type,
        'exam_name', e.exam_name,
        'performed_at', e.performed_at,
        'lab_name', e.lab_name,
        'result_text', e.result_text,
        'reference_values', e.reference_values,
        'interpretation', e.interpretation,
        'status', e.status,
        'file_url', e.file_url,
        'file_name', e.file_name,
        'notes', e.notes,
        'requested_by_name', COALESCE(pr.full_name, ''),
        'clinic_name', COALESCE(t.name, ''),
        'tuss_code', e.tuss_code,
        'priority', e.priority,
        'exam_category', e.exam_category,
        'performed_by_name', COALESCE(perf.full_name, ''),
        'created_at', e.created_at
      )
      FROM public.exam_results e
      LEFT JOIN public.profiles pr ON pr.id = e.requested_by
      LEFT JOIN public.profiles perf ON perf.id = e.performed_by
      LEFT JOIN public.tenants t ON t.id = e.tenant_id
      WHERE e.patient_id = v_link.client_id
        AND e.tenant_id = v_link.tenant_id
      ORDER BY e.created_at DESC;
  END LOOP;
END;
$$;


-- ============================================
-- Function: get_patient_certificates
-- Source: 20260703100000_fix_patient_portal_renamed_columns_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_certificates(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', mc.id,
        'tenant_id', mc.tenant_id,
        'certificate_type', mc.certificate_type,
        'issued_at', mc.issued_at,
        'days_off', mc.days_off,
        'start_date', mc.start_date,
        'end_date', mc.end_date,
        'cid_code', mc.cid_code,
        'content', mc.content,
        'notes', mc.notes,
        'professional_name', COALESCE(pr.full_name, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.medical_certificates mc
      LEFT JOIN public.profiles pr ON pr.id = mc.professional_id
      LEFT JOIN public.tenants t ON t.id = mc.tenant_id
      WHERE mc.patient_id = v_link.client_id
        AND mc.tenant_id = v_link.tenant_id
      ORDER BY mc.issued_at DESC;
  END LOOP;
END;
$$;


-- ============================================
-- Function: get_patient_medical_records
-- Source: 20260703100000_fix_patient_portal_renamed_columns_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_medical_records(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', mr.id,
        'tenant_id', mr.tenant_id,
        'record_date', mr.record_date,
        'chief_complaint', mr.chief_complaint,
        'diagnosis', mr.diagnosis,
        'cid_code', mr.cid_code,
        'treatment_plan', mr.treatment_plan,
        'professional_name', COALESCE(pr.full_name, ''),
        'specialty_name', COALESCE(sp.name, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.medical_records mr
      LEFT JOIN public.profiles pr ON pr.id = mr.professional_id
      LEFT JOIN public.specialties sp ON sp.id = mr.specialty_id
      LEFT JOIN public.tenants t ON t.id = mr.tenant_id
      WHERE mr.patient_id = v_link.client_id
        AND mr.tenant_id = v_link.tenant_id
        AND mr.is_confidential = false
      ORDER BY mr.record_date DESC;
  END LOOP;
END;
$$;


-- ============================================
-- Function: patient_cancel_appointment
-- Source: 20260327900000_patient_cancel_reschedule_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_cancel_appointment(
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
  v_apt    public.appointments%ROWTYPE;
  v_linked boolean;
  v_hours  numeric;
  v_client_name text;
  v_service_name text;
  v_professional_user_id uuid;
  v_admin_users uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT a.* INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.patient_profiles pp
    WHERE pp.user_id = v_user_id
      AND pp.tenant_id = v_apt.tenant_id
      AND pp.client_id = v_apt.client_id
      AND pp.is_active = true
  ) INTO v_linked;

  IF NOT v_linked THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta consulta';
  END IF;

  IF v_apt.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Só é possível cancelar consultas pendentes ou confirmadas. Status atual: %', v_apt.status;
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_apt.scheduled_at - now())) / 3600.0;
  IF v_hours < 24 THEN
    RAISE EXCEPTION 'Cancelamento deve ser feito com pelo menos 24 horas de antecedência (faltam %.0f horas)', v_hours;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('patient_cancel'));

  -- Get client and service names for notification
  SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = v_apt.client_id;
  SELECT s.name INTO v_service_name FROM public.services s WHERE s.id = v_apt.service_id;
  SELECT p.user_id INTO v_professional_user_id FROM public.profiles p WHERE p.id = v_apt.professional_id;

  UPDATE public.appointments
    SET status = 'cancelled',
        updated_at = now(),
        notes = CASE
          WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN COALESCE(notes, '') || E'\n[Cancelado pelo paciente via portal]'
          ELSE COALESCE(notes, '') || E'\n[Cancelado pelo paciente]: ' || p_reason
        END
  WHERE id = v_apt.id;

  -- Notify the professional
  IF v_professional_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (tenant_id, user_id, type, title, body, metadata)
    VALUES (
      v_apt.tenant_id,
      v_professional_user_id,
      'appointment_cancelled_by_patient',
      'Consulta cancelada pelo paciente',
      format('%s cancelou a consulta de %s agendada para %s', 
        v_client_name, 
        v_service_name,
        to_char(v_apt.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
      ),
      jsonb_build_object(
        'appointment_id', v_apt.id,
        'client_name', v_client_name,
        'service_name', v_service_name,
        'scheduled_at', v_apt.scheduled_at,
        'reason', p_reason
      )
    );
  END IF;

  -- Notify admins
  SELECT array_agg(ur.user_id) INTO v_admin_users
  FROM public.user_roles ur
  WHERE ur.tenant_id = v_apt.tenant_id
    AND ur.role = 'admin'
    AND ur.user_id <> COALESCE(v_professional_user_id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_admin_users IS NOT NULL AND array_length(v_admin_users, 1) > 0 THEN
    INSERT INTO public.notifications (tenant_id, user_id, type, title, body, metadata)
    SELECT 
      v_apt.tenant_id,
      admin_id,
      'appointment_cancelled_by_patient',
      'Consulta cancelada pelo paciente',
      format('%s cancelou a consulta de %s agendada para %s', 
        v_client_name, 
        v_service_name,
        to_char(v_apt.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
      ),
      jsonb_build_object(
        'appointment_id', v_apt.id,
        'client_name', v_client_name,
        'service_name', v_service_name,
        'scheduled_at', v_apt.scheduled_at,
        'reason', p_reason
      )
    FROM unnest(v_admin_users) AS admin_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_apt.id,
    'message', 'Consulta cancelada com sucesso'
  );
END;
$$;


-- ============================================
-- Function: patient_reschedule_appointment
-- Source: 20260327900000_patient_cancel_reschedule_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_reschedule_appointment(
  p_appointment_id uuid,
  p_new_scheduled_at timestamptz,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_apt        public.appointments%ROWTYPE;
  v_linked     boolean;
  v_hours      numeric;
  v_conflict   boolean;
  v_end_time   timestamptz;
  v_client_name text;
  v_service_name text;
  v_professional_user_id uuid;
  v_admin_users uuid[];
  v_old_scheduled_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT a.* INTO v_apt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.patient_profiles pp
    WHERE pp.user_id = v_user_id
      AND pp.tenant_id = v_apt.tenant_id
      AND pp.client_id = v_apt.client_id
      AND pp.is_active = true
  ) INTO v_linked;

  IF NOT v_linked THEN
    RAISE EXCEPTION 'Sem permissão para reagendar esta consulta';
  END IF;

  IF v_apt.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Só é possível reagendar consultas pendentes ou confirmadas. Status atual: %', v_apt.status;
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_apt.scheduled_at - now())) / 3600.0;
  IF v_hours < 24 THEN
    RAISE EXCEPTION 'Reagendamento deve ser feito com pelo menos 24 horas de antecedência (faltam %.0f horas)', v_hours;
  END IF;

  IF p_new_scheduled_at <= now() + interval '1 hour' THEN
    RAISE EXCEPTION 'A nova data deve ser pelo menos 1 hora no futuro';
  END IF;

  v_end_time := p_new_scheduled_at + (v_apt.duration_minutes || ' minutes')::interval;

  SELECT EXISTS(
    SELECT 1 FROM public.appointments a2
    WHERE a2.tenant_id = v_apt.tenant_id
      AND a2.professional_id = v_apt.professional_id
      AND a2.id <> v_apt.id
      AND a2.status IN ('pending', 'confirmed')
      AND a2.scheduled_at < v_end_time
      AND (a2.scheduled_at + (a2.duration_minutes || ' minutes')::interval) > p_new_scheduled_at
  ) INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'O profissional já possui outro agendamento neste horário. Escolha outro horário.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('patient_reschedule'));

  -- Store old scheduled_at for notification
  v_old_scheduled_at := v_apt.scheduled_at;

  -- Get client and service names for notification
  SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = v_apt.client_id;
  SELECT s.name INTO v_service_name FROM public.services s WHERE s.id = v_apt.service_id;
  SELECT p.user_id INTO v_professional_user_id FROM public.profiles p WHERE p.id = v_apt.professional_id;

  UPDATE public.appointments
    SET scheduled_at = p_new_scheduled_at,
        status = 'pending',
        updated_at = now(),
        notes = CASE
          WHEN p_reason IS NULL OR btrim(p_reason) = '' THEN COALESCE(notes, '') || E'\n[Reagendado pelo paciente via portal]'
          ELSE COALESCE(notes, '') || E'\n[Reagendado pelo paciente]: ' || p_reason
        END
  WHERE id = v_apt.id;

  -- Notify the professional
  IF v_professional_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (tenant_id, user_id, type, title, body, metadata)
    VALUES (
      v_apt.tenant_id,
      v_professional_user_id,
      'appointment_rescheduled_by_patient',
      'Consulta reagendada pelo paciente',
      format('%s reagendou a consulta de %s de %s para %s', 
        v_client_name, 
        v_service_name,
        to_char(v_old_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'),
        to_char(p_new_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
      ),
      jsonb_build_object(
        'appointment_id', v_apt.id,
        'client_name', v_client_name,
        'service_name', v_service_name,
        'old_scheduled_at', v_old_scheduled_at,
        'new_scheduled_at', p_new_scheduled_at,
        'reason', p_reason
      )
    );
  END IF;

  -- Notify admins
  SELECT array_agg(ur.user_id) INTO v_admin_users
  FROM public.user_roles ur
  WHERE ur.tenant_id = v_apt.tenant_id
    AND ur.role = 'admin'
    AND ur.user_id <> COALESCE(v_professional_user_id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_admin_users IS NOT NULL AND array_length(v_admin_users, 1) > 0 THEN
    INSERT INTO public.notifications (tenant_id, user_id, type, title, body, metadata)
    SELECT 
      v_apt.tenant_id,
      admin_id,
      'appointment_rescheduled_by_patient',
      'Consulta reagendada pelo paciente',
      format('%s reagendou a consulta de %s de %s para %s', 
        v_client_name, 
        v_service_name,
        to_char(v_old_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'),
        to_char(p_new_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
      ),
      jsonb_build_object(
        'appointment_id', v_apt.id,
        'client_name', v_client_name,
        'service_name', v_service_name,
        'old_scheduled_at', v_old_scheduled_at,
        'new_scheduled_at', p_new_scheduled_at,
        'reason', p_reason
      )
    FROM unnest(v_admin_users) AS admin_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_apt.id,
    'new_scheduled_at', p_new_scheduled_at,
    'message', 'Consulta reagendada com sucesso'
  );
END;
$$;


-- ============================================
-- Function: log_adverse_event_change
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION log_adverse_event_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO adverse_events_history (
      adverse_event_id, user_id, action, old_status, new_status
    ) VALUES (
      NEW.id, auth.uid(), 'STATUS_CHANGE', OLD.status, NEW.status
    );
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: generate_adverse_event_number
-- Source: 20260324600000_ona_accreditation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION generate_adverse_event_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM adverse_events
  WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  RETURN 'EA-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;


-- ============================================
-- Function: update_client_last_appointment
-- Source: 20260324700000_cfm_retention_policy_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_client_last_appointment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_retention_years INTEGER;
BEGIN
  -- Só atualiza se o appointment foi completado
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Busca o período de retenção do tenant
    SELECT COALESCE(retention_years, 20) INTO v_retention_years
    FROM tenants WHERE id = NEW.tenant_id;
    
    -- Atualiza o cliente
    UPDATE clients
    SET 
      last_appointment_date = NEW.date,
      retention_expires_at = NEW.date + (v_retention_years || ' years')::INTERVAL,
      updated_at = NOW()
    WHERE id = NEW.client_id
      AND (last_appointment_date IS NULL OR last_appointment_date < NEW.date);
  END IF;
  
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: create_return_reminder
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION create_return_reminder(
  p_medical_record_id UUID,
  p_return_days INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_notify_patient BOOLEAN DEFAULT TRUE,
  p_notify_days_before INTEGER DEFAULT 3,
  p_preferred_contact TEXT DEFAULT 'whatsapp',
  p_pre_schedule BOOLEAN DEFAULT FALSE,
  p_service_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_record RECORD;
  v_reminder_id UUID;
  v_return_date DATE;
  v_appointment_id UUID;
BEGIN
  -- Busca dados do prontuário
  SELECT 
    mr.tenant_id, mr.client_id, mr.professional_id, mr.appointment_id,
    a.service_id as appt_service_id
  INTO v_record
  FROM medical_records mr
  LEFT JOIN appointments a ON a.id = mr.appointment_id
  WHERE mr.id = p_medical_record_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prontuário não encontrado';
  END IF;
  
  -- Calcula data de retorno
  v_return_date := CURRENT_DATE + p_return_days;
  
  -- Cria o lembrete
  INSERT INTO return_reminders (
    tenant_id, medical_record_id, appointment_id, client_id, professional_id, service_id,
    return_days, return_date, reason, notify_patient, notify_days_before, preferred_contact,
    created_by
  ) VALUES (
    v_record.tenant_id, p_medical_record_id, v_record.appointment_id, v_record.client_id,
    v_record.professional_id, COALESCE(p_service_id, v_record.appt_service_id),
    p_return_days, v_return_date, p_reason, p_notify_patient, p_notify_days_before,
    p_preferred_contact, auth.uid()
  ) RETURNING id INTO v_reminder_id;
  
  -- Atualiza o prontuário
  UPDATE medical_records
  SET 
    return_days = p_return_days,
    return_reason = p_reason,
    return_reminder_id = v_reminder_id,
    updated_at = NOW()
  WHERE id = p_medical_record_id;
  
  -- Se solicitado pré-agendamento, cria appointment com status especial
  IF p_pre_schedule THEN
    INSERT INTO appointments (
      tenant_id, client_id, professional_id, service_id, date, status, notes
    ) VALUES (
      v_record.tenant_id, v_record.client_id, v_record.professional_id,
      COALESCE(p_service_id, v_record.appt_service_id), v_return_date,
      'pending', 'Retorno automático - ' || COALESCE(p_reason, 'Consulta de retorno')
    ) RETURNING id INTO v_appointment_id;
    
    -- Vincula ao lembrete
    UPDATE return_reminders
    SET 
      scheduled_appointment_id = v_appointment_id,
      status = 'scheduled'
    WHERE id = v_reminder_id;
  END IF;
  
  RETURN v_reminder_id;
END;
$$;


-- ============================================
-- Function: mark_return_notified
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION mark_return_notified(p_reminder_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE return_reminders
  SET 
    status = 'notified',
    last_notification_at = NOW(),
    notification_count = notification_count + 1,
    updated_at = NOW()
  WHERE id = p_reminder_id;
END;
$$;


-- ============================================
-- Function: link_appointment_to_return
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION link_appointment_to_return(
  p_reminder_id UUID,
  p_appointment_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE return_reminders
  SET 
    scheduled_appointment_id = p_appointment_id,
    status = 'scheduled',
    updated_at = NOW()
  WHERE id = p_reminder_id;
END;
$$;


-- ============================================
-- Function: complete_return_reminder
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION complete_return_reminder(p_reminder_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE return_reminders
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_reminder_id;
END;
$$;


-- ============================================
-- Function: check_return_on_appointment_complete
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION check_return_on_appointment_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Marca retornos vinculados como completados
    UPDATE return_reminders
    SET status = 'completed', updated_at = NOW()
    WHERE scheduled_appointment_id = NEW.id
      AND status IN ('pending', 'notified', 'scheduled');
    
    -- Também verifica se é um retorno do mesmo paciente/profissional
    UPDATE return_reminders
    SET status = 'completed', updated_at = NOW()
    WHERE client_id = NEW.client_id
      AND professional_id = NEW.professional_id
      AND status IN ('pending', 'notified')
      AND return_date BETWEEN NEW.date - INTERVAL '7 days' AND NEW.date + INTERVAL '7 days';
  END IF;
  
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_return_statistics
-- Source: 20260324800000_return_automation_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_return_statistics(
  p_tenant_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
) RETURNS TABLE (
  total_reminders BIGINT,
  pending_count BIGINT,
  notified_count BIGINT,
  scheduled_count BIGINT,
  completed_count BIGINT,
  expired_count BIGINT,
  overdue_count BIGINT,
  completion_rate NUMERIC,
  avg_days_to_return NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_reminders,
    COUNT(*) FILTER (WHERE rr.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE rr.status = 'notified') as notified_count,
    COUNT(*) FILTER (WHERE rr.status = 'scheduled') as scheduled_count,
    COUNT(*) FILTER (WHERE rr.status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE rr.status = 'expired') as expired_count,
    COUNT(*) FILTER (WHERE rr.status IN ('pending', 'notified') AND rr.return_date < CURRENT_DATE) as overdue_count,
    ROUND(
      COUNT(*) FILTER (WHERE rr.status = 'completed')::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE rr.status IN ('completed', 'expired')), 0) * 100, 
      1
    ) as completion_rate,
    ROUND(AVG(rr.return_days)::NUMERIC, 1) as avg_days_to_return
  FROM return_reminders rr
  WHERE rr.tenant_id = p_tenant_id
    AND (p_from_date IS NULL OR rr.created_at::DATE >= p_from_date)
    AND (p_to_date IS NULL OR rr.created_at::DATE <= p_to_date);
END;
$$;


-- ============================================
-- Function: add_patient_to_queue
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE FUNCTION public.add_patient_to_queue(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_triage_id UUID DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL,
  p_priority INTEGER DEFAULT 5,
  p_priority_label TEXT DEFAULT 'Normal'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_call_id UUID;
  v_existing_id UUID;
  v_call_number INTEGER;
  v_room_name TEXT;
  v_professional_name TEXT;
BEGIN
  -- Idempotente: se já está na fila hoje, retorna ID existente
  SELECT id INTO v_existing_id
  FROM patient_calls
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id
    AND created_at::DATE = CURRENT_DATE
    AND status IN ('waiting', 'calling', 'in_service')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_call_number := generate_call_number(p_tenant_id);

  IF p_room_id IS NOT NULL THEN
    SELECT name INTO v_room_name FROM clinic_rooms WHERE id = p_room_id;
  END IF;

  IF p_professional_id IS NOT NULL THEN
    SELECT full_name INTO v_professional_name FROM profiles WHERE id = p_professional_id;
  END IF;

  INSERT INTO patient_calls (
    tenant_id, patient_id, appointment_id, triage_id,
    room_id, room_name, professional_id, professional_name,
    priority, priority_label, call_number, status
  ) VALUES (
    p_tenant_id, p_patient_id, p_appointment_id, p_triage_id,
    p_room_id, v_room_name, p_professional_id, v_professional_name,
    p_priority, p_priority_label, v_call_number, 'waiting'
  ) RETURNING id INTO v_call_id;

  RETURN v_call_id;
END;
$$;


-- ============================================
-- Function: get_waiting_queue
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE FUNCTION public.get_waiting_queue(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  call_id UUID,
  patient_id UUID,
  client_name TEXT,
  call_number INTEGER,
  priority INTEGER,
  priority_label TEXT,
  room_name TEXT,
  professional_name TEXT,
  checked_in_at TIMESTAMPTZ,
  wait_time_minutes INTEGER,
  queue_position INTEGER,
  appointment_id UUID,
  service_name TEXT,
  is_triaged BOOLEAN,
  triage_priority TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id, pc.patient_id, c.name, pc.call_number, pc.priority, pc.priority_label,
    pc.room_name, pc.professional_name, pc.checked_in_at,
    EXTRACT(EPOCH FROM (NOW() - pc.checked_in_at))::INTEGER / 60,
    ROW_NUMBER() OVER (ORDER BY pc.priority ASC, pc.checked_in_at ASC)::INTEGER,
    pc.appointment_id, pr.name,
    COALESCE(pc.is_triaged, FALSE), pc.triage_priority
  FROM patient_calls pc
  JOIN patients c ON c.id = pc.patient_id
  LEFT JOIN appointments a ON a.id = pc.appointment_id
  LEFT JOIN procedures pr ON pr.id = a.procedure_id
  WHERE pc.tenant_id = p_tenant_id
    AND pc.status = 'waiting'
    AND pc.created_at::DATE = CURRENT_DATE
  ORDER BY pc.priority ASC, pc.checked_in_at ASC
  LIMIT p_limit;
END;
$$;


-- ============================================
-- Function: get_queue_statistics
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE FUNCTION public.get_queue_statistics(p_tenant_id UUID)
RETURNS TABLE (
  total_today INTEGER,
  waiting_count INTEGER,
  calling_count INTEGER,
  in_service_count INTEGER,
  completed_count INTEGER,
  no_show_count INTEGER,
  avg_wait_time_minutes NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'waiting')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'calling')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'in_service')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'completed')::INTEGER,
    COUNT(*) FILTER (WHERE pc.status = 'no_show')::INTEGER,
    ROUND(AVG(
      CASE WHEN pc.first_called_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (pc.first_called_at - pc.checked_in_at)) / 60 
      END
    )::NUMERIC, 1)
  FROM patient_calls pc
  WHERE pc.tenant_id = p_tenant_id
    AND pc.created_at::DATE = CURRENT_DATE;
END;
$$;


-- ============================================
-- Function: auto_add_to_queue_on_triage
-- Source: 20260627300000_fix_queue_functions_client_to_patient.sql
-- ============================================
CREATE OR REPLACE FUNCTION auto_add_to_queue_on_triage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_priority INTEGER;
  v_priority_label TEXT;
BEGIN
  CASE NEW.risk_classification
    WHEN 'emergencia' THEN v_priority := 1; v_priority_label := 'Emergência';
    WHEN 'muito_urgente' THEN v_priority := 2; v_priority_label := 'Muito Urgente';
    WHEN 'urgente' THEN v_priority := 3; v_priority_label := 'Urgente';
    WHEN 'pouco_urgente' THEN v_priority := 4; v_priority_label := 'Pouco Urgente';
    ELSE v_priority := 5; v_priority_label := 'Normal';
  END CASE;
  
  PERFORM add_patient_to_queue(
    NEW.tenant_id,
    NEW.patient_id,
    NEW.appointment_id,
    NEW.id,
    NULL,
    NULL,
    v_priority,
    v_priority_label
  );
  
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: hc_on_appointment_completed
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.hc_on_appointment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_patient_id uuid;
  v_today_count integer;
BEGIN
  -- Só dispara quando status muda para 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Buscar patient_id do client
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE id = NEW.client_id
    AND tenant_id = NEW.tenant_id;

  IF v_patient_id IS NULL THEN
    -- client pode não ser patient (caso edge)
    RETURN NEW;
  END IF;

  -- Buscar regra ativa para appointment_completed
  FOR v_rule IN
    SELECT * FROM public.health_credits_rules
    WHERE tenant_id = NEW.tenant_id
      AND trigger_type = 'appointment_completed'
      AND is_active = true
  LOOP
    -- Verificar limite diário se configurado
    IF v_rule.max_per_day IS NOT NULL THEN
      SELECT COUNT(*) INTO v_today_count
      FROM public.health_credits_transactions
      WHERE tenant_id = NEW.tenant_id
        AND patient_id = v_patient_id
        AND reference_type = 'appointment'
        AND type = 'earn'
        AND created_at::date = CURRENT_DATE;

      IF v_today_count >= v_rule.max_per_day THEN
        CONTINUE;
      END IF;
    END IF;

    -- Conceder créditos
    PERFORM public.award_health_credits(
      NEW.tenant_id,
      v_patient_id,
      v_rule.points,
      'Consulta realizada — ' || COALESCE(
        (SELECT name FROM public.services WHERE id = NEW.service_id),
        'Atendimento'
      ),
      'appointment',
      NEW.id,
      v_rule.expiry_days,
      NULL -- system action
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_available_slots_for_patient
-- Source: APLICAR_MIGRATION_700000_800000.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_available_slots_for_patient(
  p_service_id uuid,
  p_professional_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS TABLE (
  slot_date date,
  slot_time time,
  slot_datetime timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_service public.procedures%ROWTYPE;
  v_min_hours integer;
  v_max_days integer;
  v_min_datetime timestamptz;
  v_max_datetime timestamptz;
  v_current_date date;
  v_day_of_week integer;
  v_slot_start time;
  v_slot_end time;
  v_slot_datetime timestamptz;
  v_duration interval;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  SELECT t.patient_booking_min_hours_advance, t.patient_booking_max_days_advance
  INTO v_min_hours, v_max_days
  FROM public.tenants t WHERE t.id = v_tenant_id;

  SELECT * INTO v_service
  FROM public.procedures s
  WHERE s.id = p_service_id AND s.tenant_id = v_tenant_id AND s.is_active = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado'; END IF;

  v_duration := make_interval(mins => v_service.duration_minutes);
  v_min_datetime := now() + make_interval(hours => v_min_hours);
  v_max_datetime := now() + make_interval(days => v_max_days);

  IF p_date_from < v_min_datetime::date THEN v_current_date := v_min_datetime::date;
  ELSE v_current_date := p_date_from; END IF;

  IF p_date_to > v_max_datetime::date THEN p_date_to := v_max_datetime::date; END IF;

  WHILE v_current_date <= p_date_to LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::integer;

    FOR v_slot_start, v_slot_end IN
      SELECT wh.start_time, wh.end_time
      FROM public.professional_working_hours wh
      WHERE wh.tenant_id = v_tenant_id
        AND wh.professional_id = p_professional_id
        AND wh.day_of_week = v_day_of_week
        AND wh.is_active = true
    LOOP
      WHILE v_slot_start + v_duration <= v_slot_end LOOP
        v_slot_datetime := v_current_date + v_slot_start;

        IF v_slot_datetime >= v_min_datetime THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.tenant_id = v_tenant_id
              AND a.professional_id = p_professional_id
              AND a.status NOT IN ('cancelled')
              AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
                  && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')
          ) THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.schedule_blocks sb
              WHERE sb.tenant_id = v_tenant_id
                AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
                AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(v_slot_datetime, v_slot_datetime + v_duration, '[)')
            ) THEN
              slot_date := v_current_date;
              slot_time := v_slot_start;
              slot_datetime := v_slot_datetime;
              RETURN NEXT;
            END IF;
          END IF;
        END IF;

        v_slot_start := v_slot_start + interval '30 minutes';
      END LOOP;
    END LOOP;

    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$;


-- ============================================
-- Function: patient_create_appointment
-- Source: APLICAR_MIGRATION_700000_800000.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_create_appointment(
  p_procedure_id uuid,
  p_professional_id uuid,
  p_scheduled_at timestamptz,
  p_for_dependent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
  v_service public.procedures%ROWTYPE;
  v_tenant public.tenants%ROWTYPE;
  v_pending_count integer;
  v_min_datetime timestamptz;
  v_max_datetime timestamptz;
  v_end_at timestamptz;
  v_has_conflict boolean;
  v_blocked boolean;
  v_within boolean;
  v_appointment_id uuid;
  v_booked_for uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica'; END IF;

  IF p_for_dependent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.patient_dependents pd
      WHERE pd.id = p_for_dependent_id
        AND pd.parent_patient_id = v_client_id
        AND pd.is_active = true
    ) THEN
      RAISE EXCEPTION 'Dependente não encontrado';
    END IF;
    SELECT pd.dependent_patient_id INTO v_booked_for
    FROM public.patient_dependents pd WHERE pd.id = p_for_dependent_id;
  ELSE
    v_booked_for := v_client_id;
  END IF;

  SELECT * INTO v_tenant FROM public.tenants t WHERE t.id = v_tenant_id;

  IF NOT v_tenant.patient_booking_enabled THEN
    RAISE EXCEPTION 'Agendamento online não está habilitado para esta clínica';
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.appointments a
  WHERE a.tenant_id = v_tenant_id
    AND a.patient_id = v_booked_for
    AND a.status IN ('pending', 'confirmed')
    AND a.scheduled_at > now();

  IF v_pending_count >= v_tenant.patient_booking_max_pending_per_patient THEN
    RAISE EXCEPTION 'Limite de % agendamentos pendentes atingido', v_tenant.patient_booking_max_pending_per_patient;
  END IF;

  SELECT * INTO v_service
  FROM public.procedures s
  WHERE s.id = p_procedure_id AND s.tenant_id = v_tenant_id AND s.is_active = true AND s.patient_bookable = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não disponível para agendamento online'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_professional_id AND p.tenant_id = v_tenant_id AND p.patient_bookable = true
  ) THEN
    RAISE EXCEPTION 'Profissional não disponível para agendamento online';
  END IF;

  v_min_datetime := now() + make_interval(hours => v_tenant.patient_booking_min_hours_advance);
  v_max_datetime := now() + make_interval(days => v_tenant.patient_booking_max_days_advance);

  IF p_scheduled_at < v_min_datetime THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com pelo menos % horas de antecedência', v_tenant.patient_booking_min_hours_advance;
  END IF;
  IF p_scheduled_at > v_max_datetime THEN
    RAISE EXCEPTION 'Agendamento deve ser feito com no máximo % dias de antecedência', v_tenant.patient_booking_max_days_advance;
  END IF;

  v_end_at := p_scheduled_at + make_interval(mins => v_service.duration_minutes);

  BEGIN
    v_within := public.is_slot_within_working_hours_v1(v_tenant_id, p_professional_id, p_scheduled_at, v_end_at);
    IF v_within IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Horário fora do expediente do profissional';
    END IF;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;

  SELECT EXISTS(
    SELECT 1 FROM public.schedule_blocks sb
    WHERE sb.tenant_id = v_tenant_id
      AND (sb.professional_id IS NULL OR sb.professional_id = p_professional_id)
      AND tstzrange(sb.start_at, sb.end_at, '[)') && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) INTO v_blocked;

  IF v_blocked THEN RAISE EXCEPTION 'Horário bloqueado na agenda'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id = v_tenant_id
      AND a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled')
      AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
          && tstzrange(p_scheduled_at, v_end_at, '[)')
  ) INTO v_has_conflict;

  IF v_has_conflict THEN RAISE EXCEPTION 'Este horário não está mais disponível'; END IF;

  INSERT INTO public.appointments (
    tenant_id, patient_id, procedure_id, professional_id,
    scheduled_at, duration_minutes, status, price
  ) VALUES (
    v_tenant_id, v_booked_for, v_service.id, p_professional_id,
    p_scheduled_at, v_service.duration_minutes, 'pending', v_service.price
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'message', 'Agendamento realizado com sucesso! Aguarde a confirmação da clínica.'
  );
END;
$$;


-- ============================================
-- Function: submit_appointment_rating
-- Source: APLICAR_MIGRATION_700000_800000.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_appointment_rating(
  p_appointment_id uuid,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  SELECT * INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.patient_id = v_client_id
    AND a.tenant_id = v_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Consulta não encontrada'; END IF;

  IF v_appointment.status != 'completed' THEN
    RAISE EXCEPTION 'Apenas consultas concluídas podem ser avaliadas';
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointment_ratings WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'Esta consulta já foi avaliada';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Avaliação deve ser entre 1 e 5';
  END IF;

  INSERT INTO public.appointment_ratings (
    tenant_id, appointment_id, patient_user_id, rating, comment
  ) VALUES (
    v_tenant_id, p_appointment_id, v_user_id, p_rating, NULLIF(BTRIM(p_comment), '')
  );

  RETURN jsonb_build_object('success', true, 'message', 'Obrigado pela sua avaliação!');
END;
$$;


-- ============================================
-- Function: get_patient_vital_signs_history
-- Source: 20260724500000_fix_patient_saude_rpcs_v4.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_vital_signs_history(p_limit integer DEFAULT 20)
RETURNS TABLE (
  recorded_at      timestamptz,
  weight           numeric,
  height           numeric,
  blood_pressure   text,
  heart_rate       integer,
  temperature      numeric,
  oxygen_saturation numeric,
  glucose          numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT
    tr.triaged_at                                                   AS recorded_at,
    tr.weight_kg                                                    AS weight,
    tr.height_cm::numeric                                           AS height,
    CASE
      WHEN tr.blood_pressure_systolic IS NOT NULL
       AND tr.blood_pressure_diastolic IS NOT NULL
      THEN tr.blood_pressure_systolic::text || '/' || tr.blood_pressure_diastolic::text
      ELSE NULL
    END                                                             AS blood_pressure,
    tr.heart_rate,
    tr.temperature,
    tr.oxygen_saturation,
    NULL::numeric                                                   AS glucose
  FROM public.triage_records tr
  WHERE tr.patient_id = v_client_id
    AND (
      tr.weight_kg IS NOT NULL
      OR tr.blood_pressure_systolic IS NOT NULL
      OR tr.heart_rate IS NOT NULL
    )
  ORDER BY tr.triaged_at DESC
  LIMIT p_limit;
END;
$$;


-- ============================================
-- Function: get_patient_vaccinations
-- Source: 20260724500000_fix_patient_saude_rpcs_v4.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_vaccinations()
RETURNS TABLE (
  id              uuid,
  vaccine_name    text,
  dose_number     integer,
  batch_number    text,
  manufacturer    text,
  administered_at date,
  administered_by text,
  next_dose_date  date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT
    pv.id,
    pv.vaccine_name,
    pv.dose_number,
    pv.batch_number,
    pv.manufacturer,
    pv.administered_at,
    pv.administered_by,
    pv.next_dose_date
  FROM public.patient_vaccinations pv
  WHERE pv.client_id = v_client_id
  ORDER BY pv.administered_at DESC;
END;
$$;


-- ============================================
-- Function: trigger_check_tier_on_appointment_complete
-- Source: 20260327500000_tier_change_notification_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_check_tier_on_appointment_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Só verificar se o status mudou para 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        PERFORM public.check_and_notify_tier_change(NEW.tenant_id, NEW.professional_id);
    END IF;
    
    RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_tenant_queue_settings
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tenant_queue_settings(p_tenant_id UUID)
RETURNS TABLE (auto_queue_on_checkin BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT t.auto_queue_on_checkin FROM tenants t WHERE t.id = p_tenant_id;
END;
$$;


-- ============================================
-- Function: update_tenant_queue_settings
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_tenant_queue_settings(
  p_tenant_id UUID, p_auto_queue_on_checkin BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_tenant_admin(auth.uid(), p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar configurações';
  END IF;
  UPDATE tenants SET auto_queue_on_checkin = p_auto_queue_on_checkin WHERE id = p_tenant_id;
END;
$$;


-- ============================================
-- Function: generate_return_confirmation_token
-- Source: 20260328600000_return_notification_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION generate_return_confirmation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


-- ============================================
-- Function: create_return_confirmation_link
-- Source: 20260328600000_return_notification_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION create_return_confirmation_link(
  p_tenant_id UUID,
  p_return_id UUID,
  p_expires_hours INTEGER DEFAULT 72
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Verificar se o retorno existe e pertence ao tenant
  SELECT EXISTS(
    SELECT 1 FROM return_reminders
    WHERE id = p_return_id AND tenant_id = p_tenant_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Retorno não encontrado';
  END IF;
  
  -- Verificar se já existe um token válido
  SELECT token INTO v_token
  FROM return_confirmation_tokens
  WHERE return_id = p_return_id
    AND used_at IS NULL
    AND expires_at > NOW()
  LIMIT 1;
  
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;
  
  -- Gerar novo token
  v_token := generate_return_confirmation_token();
  
  -- Garantir unicidade
  WHILE EXISTS(SELECT 1 FROM return_confirmation_tokens WHERE token = v_token) LOOP
    v_token := generate_return_confirmation_token();
  END LOOP;
  
  -- Inserir token
  INSERT INTO return_confirmation_tokens (
    tenant_id,
    return_id,
    token,
    expires_at
  ) VALUES (
    p_tenant_id,
    p_return_id,
    v_token,
    NOW() + (p_expires_hours || ' hours')::INTERVAL
  );
  
  RETURN v_token;
END;
$$;


-- ============================================
-- Function: validate_return_token
-- Source: 20260328600000_return_notification_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION validate_return_token(p_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  return_id UUID,
  tenant_id UUID,
  client_id UUID,
  client_name TEXT,
  professional_name TEXT,
  return_date DATE,
  reason TEXT,
  status TEXT,
  clinic_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Buscar token
  SELECT 
    rct.*,
    rr.client_id,
    rr.professional_id,
    rr.return_date,
    rr.reason,
    rr.status as return_status
  INTO v_token_record
  FROM return_confirmation_tokens rct
  JOIN return_reminders rr ON rr.id = rct.return_id
  WHERE rct.token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::BOOLEAN, 
      NULL::UUID, NULL::UUID, NULL::UUID, 
      NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Verificar se expirou ou já foi usado
  IF v_token_record.expires_at < NOW() OR v_token_record.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN, 
      NULL::UUID, NULL::UUID, NULL::UUID, 
      NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Buscar dados adicionais
  RETURN QUERY
  SELECT 
    true::BOOLEAN as valid,
    v_token_record.return_id,
    v_token_record.tenant_id,
    v_token_record.client_id,
    c.name::TEXT as client_name,
    COALESCE(p.full_name, '')::TEXT as professional_name,
    v_token_record.return_date,
    v_token_record.reason::TEXT,
    v_token_record.return_status::TEXT as status,
    t.name::TEXT as clinic_name
  FROM clients c
  LEFT JOIN profiles p ON p.id = v_token_record.professional_id
  LEFT JOIN tenants t ON t.id = v_token_record.tenant_id
  WHERE c.id = v_token_record.client_id;
END;
$$;


-- ============================================
-- Function: confirm_return_via_token
-- Source: 20260328600000_return_notification_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION confirm_return_via_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Buscar e validar token
  SELECT rct.*, rr.status as return_status
  INTO v_token_record
  FROM return_confirmation_tokens rct
  JOIN return_reminders rr ON rr.id = rct.return_id
  WHERE rct.token = p_token
    AND rct.expires_at > NOW()
    AND rct.used_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Marcar token como usado
  UPDATE return_confirmation_tokens
  SET used_at = NOW(), action = 'confirmed'
  WHERE id = v_token_record.id;
  
  -- Atualizar status do retorno para 'scheduled' (confirmado pelo paciente)
  UPDATE return_reminders
  SET status = 'scheduled'
  WHERE id = v_token_record.return_id;
  
  RETURN true;
END;
$$;


-- ============================================
-- Function: cancel_return_via_token
-- Source: 20260328600000_return_notification_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION cancel_return_via_token(p_token TEXT, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Buscar e validar token
  SELECT rct.*, rr.status as return_status
  INTO v_token_record
  FROM return_confirmation_tokens rct
  JOIN return_reminders rr ON rr.id = rct.return_id
  WHERE rct.token = p_token
    AND rct.expires_at > NOW()
    AND rct.used_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Marcar token como usado
  UPDATE return_confirmation_tokens
  SET used_at = NOW(), action = 'cancelled'
  WHERE id = v_token_record.id;
  
  -- Atualizar status do retorno para 'cancelled'
  UPDATE return_reminders
  SET 
    status = 'cancelled',
    notes = COALESCE(notes || E'\n', '') || 'Cancelado pelo paciente' || 
            CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END
  WHERE id = v_token_record.return_id;
  
  RETURN true;
END;
$$;


-- ============================================
-- Function: get_time_slot_no_show_rate
-- Source: 20260329200000_ai_integration_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_time_slot_no_show_rate(
    p_tenant_id UUID,
    p_day_of_week INTEGER,
    p_hour INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
    v_total INTEGER;
    v_no_shows INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'no_show')
    INTO v_total, v_no_shows
    FROM appointments
    WHERE tenant_id = p_tenant_id
      AND EXTRACT(DOW FROM scheduled_at) = p_day_of_week
      AND EXTRACT(HOUR FROM scheduled_at) = p_hour
      AND scheduled_at >= NOW() - INTERVAL '90 days';
    
    IF v_total < 10 THEN
        RETURN 0.10; -- Default 10% if not enough data
    END IF;
    
    RETURN v_no_shows::DECIMAL / v_total::DECIMAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Function: register_appointment_payment
-- Source: 20260628200000_fix_financial_rpcs_renamed_columns.sql
-- ============================================
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


-- ============================================
-- Function: generate_certificate_hash
-- Source: 20260330600000_certificate_digital_signature_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_certificate_hash(
  p_certificate_type TEXT,
  p_content TEXT,
  p_days_off INTEGER,
  p_start_date DATE,
  p_end_date DATE,
  p_cid_code TEXT,
  p_notes TEXT,
  p_patient_id UUID,
  p_issued_at TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload TEXT;
  v_hash TEXT;
BEGIN
  -- Construir payload ordenado para hash determinístico
  v_payload := jsonb_build_object(
    'certificate_type', COALESCE(p_certificate_type, ''),
    'cid_code', COALESCE(p_cid_code, ''),
    'content', COALESCE(p_content, ''),
    'days_off', COALESCE(p_days_off, 0),
    'end_date', COALESCE(p_end_date::TEXT, ''),
    'issued_at', COALESCE(p_issued_at::TEXT, ''),
    'notes', COALESCE(p_notes, ''),
    'patient_id', COALESCE(p_patient_id::TEXT, ''),
    'start_date', COALESCE(p_start_date::TEXT, '')
  )::TEXT;

  -- Gerar hash SHA-256
  v_hash := encode(sha256(v_payload::bytea), 'hex');
  
  RETURN v_hash;
END;
$$;


-- ============================================
-- Function: sign_medical_certificate
-- Source: 20260330800000_cfm_required_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.sign_medical_certificate(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_cert RECORD;
  v_profile RECORD;
  v_content_hash TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  v_tenant_id := public.get_user_tenant_id(v_user_id);
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant não encontrado');
  END IF;

  SELECT * INTO v_cert
  FROM public.medical_certificates
  WHERE id = p_certificate_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado não encontrado');
  END IF;

  IF v_cert.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado já foi assinado');
  END IF;

  SELECT full_name, council_number as crm, council_state as uf, 
         CASE 
           WHEN professional_type = 'medico' THEN 'Médico(a)'
           WHEN professional_type = 'dentista' THEN 'Cirurgião(ã)-Dentista'
           WHEN professional_type = 'enfermeiro' THEN 'Enfermeiro(a)'
           WHEN professional_type = 'fisioterapeuta' THEN 'Fisioterapeuta'
           WHEN professional_type = 'nutricionista' THEN 'Nutricionista'
           WHEN professional_type = 'psicologo' THEN 'Psicólogo(a)'
           WHEN professional_type = 'fonoaudiologo' THEN 'Fonoaudiólogo(a)'
           ELSE professional_type::text
         END as specialty
  INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile.crm IS NULL OR v_profile.crm = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional sem número de conselho cadastrado');
  END IF;

  v_content_hash := public.generate_certificate_hash(p_certificate_id);

  UPDATE public.medical_certificates
  SET 
    digital_signature = v_content_hash,
    content_hash = v_content_hash,
    signed_at = NOW(),
    signed_by_name = v_profile.full_name,
    signed_by_crm = v_profile.crm,
    signed_by_uf = v_profile.uf,
    signed_by_specialty = v_profile.specialty,
    server_timestamp = COALESCE(server_timestamp, NOW()),
    updated_at = NOW()
  WHERE id = p_certificate_id;

  RETURN jsonb_build_object(
    'success', true,
    'hash', v_content_hash,
    'signed_at', NOW(),
    'signed_by', v_profile.full_name,
    'crm', v_profile.crm,
    'uf', v_profile.uf
  );
END;
$$;


-- ============================================
-- Function: verify_certificate_signature
-- Source: 20260330800000_cfm_required_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.verify_certificate_signature(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_cert RECORD;
  v_current_hash TEXT;
  v_is_valid BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  v_tenant_id := public.get_user_tenant_id(v_user_id);
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant não encontrado');
  END IF;

  SELECT * INTO v_cert
  FROM public.medical_certificates
  WHERE id = p_certificate_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado não encontrado');
  END IF;

  IF v_cert.signed_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Atestado não foi assinado');
  END IF;

  v_current_hash := public.generate_certificate_hash(p_certificate_id);
  v_is_valid := (v_current_hash = v_cert.content_hash);

  RETURN jsonb_build_object(
    'success', true,
    'is_valid', v_is_valid,
    'original_hash', v_cert.content_hash,
    'current_hash', v_current_hash,
    'signed_at', v_cert.signed_at,
    'signed_by', v_cert.signed_by_name,
    'crm', v_cert.signed_by_crm,
    'uf', v_cert.signed_by_uf,
    'specialty', v_cert.signed_by_specialty,
    'server_timestamp', v_cert.server_timestamp
  );
END;
$$;


-- ============================================
-- Function: protect_signed_certificate
-- Source: 20260330600000_certificate_digital_signature_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.protect_signed_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se o documento já estava assinado, impedir alterações no conteúdo
  IF OLD.signed_at IS NOT NULL THEN
    -- Permitir apenas atualização de printed_at
    IF NEW.content != OLD.content 
       OR NEW.certificate_type != OLD.certificate_type
       OR NEW.days_off IS DISTINCT FROM OLD.days_off
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.cid_code IS DISTINCT FROM OLD.cid_code
       OR NEW.notes IS DISTINCT FROM OLD.notes
    THEN
      RAISE EXCEPTION 'Não é permitido alterar o conteúdo de um atestado assinado digitalmente. Crie um novo documento.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: ensure_single_default_certificate
-- Source: 20260330700000_profile_certificates_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_single_default_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.profile_certificates
    SET is_default = false, updated_at = NOW()
    WHERE profile_id = NEW.profile_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: register_certificate_a1
-- Source: 20260330700000_profile_certificates_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.register_certificate_a1(
  p_common_name TEXT,
  p_cpf_cnpj TEXT,
  p_issuer TEXT,
  p_serial_number TEXT,
  p_not_before TIMESTAMPTZ,
  p_not_after TIMESTAMPTZ,
  p_thumbprint TEXT,
  p_encrypted_pfx BYTEA,
  p_encryption_iv BYTEA,
  p_encryption_salt BYTEA,
  p_nickname TEXT DEFAULT NULL,
  p_is_default BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_tenant_id UUID;
  v_cert_id UUID;
  v_existing UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id, tenant_id INTO v_profile_id, v_tenant_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  -- Verificar se certificado já existe
  SELECT id INTO v_existing
  FROM public.profile_certificates
  WHERE profile_id = v_profile_id AND thumbprint = p_thumbprint;

  IF v_existing IS NOT NULL THEN
    -- Atualizar certificado existente
    UPDATE public.profile_certificates
    SET 
      encrypted_pfx = p_encrypted_pfx,
      encryption_iv = p_encryption_iv,
      encryption_salt = p_encryption_salt,
      nickname = COALESCE(p_nickname, nickname),
      is_default = p_is_default,
      is_active = true,
      updated_at = NOW()
    WHERE id = v_existing
    RETURNING id INTO v_cert_id;

    RETURN jsonb_build_object(
      'success', true,
      'certificate_id', v_cert_id,
      'message', 'Certificado atualizado com sucesso',
      'updated', true
    );
  END IF;

  -- Inserir novo certificado
  INSERT INTO public.profile_certificates (
    profile_id, tenant_id, certificate_type,
    common_name, cpf_cnpj, issuer, serial_number,
    not_before, not_after, thumbprint,
    encrypted_pfx, encryption_iv, encryption_salt,
    nickname, is_default
  ) VALUES (
    v_profile_id, v_tenant_id, 'A1',
    p_common_name, p_cpf_cnpj, p_issuer, p_serial_number,
    p_not_before, p_not_after, p_thumbprint,
    p_encrypted_pfx, p_encryption_iv, p_encryption_salt,
    p_nickname, p_is_default
  )
  RETURNING id INTO v_cert_id;

  RETURN jsonb_build_object(
    'success', true,
    'certificate_id', v_cert_id,
    'message', 'Certificado cadastrado com sucesso',
    'updated', false
  );
END;
$$;


-- ============================================
-- Function: list_my_certificates
-- Source: 20260330700000_profile_certificates_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.list_my_certificates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_certs JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'certificate_type', c.certificate_type,
      'common_name', c.common_name,
      'cpf_cnpj', c.cpf_cnpj,
      'issuer', c.issuer,
      'serial_number', c.serial_number,
      'not_before', c.not_before,
      'not_after', c.not_after,
      'thumbprint', c.thumbprint,
      'is_active', c.is_active,
      'is_default', c.is_default,
      'nickname', c.nickname,
      'created_at', c.created_at,
      'last_used_at', c.last_used_at,
      'days_until_expiry', EXTRACT(DAY FROM (c.not_after - NOW())),
      'is_expired', c.not_after < NOW(),
      'has_encrypted_pfx', c.encrypted_pfx IS NOT NULL
    ) ORDER BY c.is_default DESC, c.created_at DESC
  ), '[]'::jsonb) INTO v_certs
  FROM public.profile_certificates c
  WHERE c.profile_id = v_profile_id AND c.is_active = true;

  RETURN jsonb_build_object('success', true, 'certificates', v_certs);
END;
$$;


-- ============================================
-- Function: get_certificate_for_signing
-- Source: 20260330700000_profile_certificates_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_certificate_for_signing(
  p_certificate_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_cert RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  -- Buscar certificado específico ou padrão
  IF p_certificate_id IS NOT NULL THEN
    SELECT * INTO v_cert
    FROM public.profile_certificates
    WHERE id = p_certificate_id 
      AND profile_id = v_profile_id 
      AND is_active = true;
  ELSE
    SELECT * INTO v_cert
    FROM public.profile_certificates
    WHERE profile_id = v_profile_id 
      AND is_active = true 
      AND is_default = true;

    IF NOT FOUND THEN
      SELECT * INTO v_cert
      FROM public.profile_certificates
      WHERE profile_id = v_profile_id 
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum certificado encontrado');
  END IF;

  IF v_cert.not_after < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificado expirado');
  END IF;

  -- Atualizar last_used_at
  UPDATE public.profile_certificates
  SET last_used_at = NOW()
  WHERE id = v_cert.id;

  RETURN jsonb_build_object(
    'success', true,
    'certificate', jsonb_build_object(
      'id', v_cert.id,
      'certificate_type', v_cert.certificate_type,
      'common_name', v_cert.common_name,
      'cpf_cnpj', v_cert.cpf_cnpj,
      'issuer', v_cert.issuer,
      'thumbprint', v_cert.thumbprint,
      'encrypted_pfx', encode(v_cert.encrypted_pfx, 'base64'),
      'encryption_iv', encode(v_cert.encryption_iv, 'base64'),
      'encryption_salt', encode(v_cert.encryption_salt, 'base64')
    )
  );
END;
$$;


-- ============================================
-- Function: set_default_certificate
-- Source: 20260330700000_profile_certificates_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_default_certificate(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_cert_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.profile_certificates
    WHERE id = p_certificate_id AND profile_id = v_profile_id AND is_active = true
  ) INTO v_cert_exists;

  IF NOT v_cert_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificado não encontrado');
  END IF;

  UPDATE public.profile_certificates
  SET is_default = true
  WHERE id = p_certificate_id;

  RETURN jsonb_build_object('success', true, 'message', 'Certificado definido como padrão');
END;
$$;


-- ============================================
-- Function: remove_certificate
-- Source: 20260330700000_profile_certificates_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.remove_certificate(p_certificate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id;

  UPDATE public.profile_certificates
  SET is_active = false, updated_at = NOW()
  WHERE id = p_certificate_id AND profile_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificado não encontrado');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Certificado removido');
END;
$$;


-- ============================================
-- Function: next_attendance_number
-- Source: 20260330800000_cfm_required_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.next_attendance_number(p_tenant_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO public.tenant_sequences (tenant_id, attendance_seq)
  VALUES (p_tenant_id, 1)
  ON CONFLICT (tenant_id) DO UPDATE
  SET attendance_seq = public.tenant_sequences.attendance_seq + 1,
      updated_at = NOW()
  RETURNING attendance_seq INTO v_next;
  
  RETURN v_next;
END;
$$;


-- ============================================
-- Function: set_attendance_number
-- Source: 20260330800000_cfm_required_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.set_attendance_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attendance_number IS NULL THEN
    NEW.attendance_number := public.next_attendance_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: generate_prescription_hash
-- Source: 20260331000000_prescriptions_signature_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_prescription_hash(
  p_prescription_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rx RECORD;
  v_payload TEXT;
  v_hash TEXT;
BEGIN
  SELECT * INTO v_rx FROM public.prescriptions WHERE id = p_prescription_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_payload := jsonb_build_object(
    'id', v_rx.id,
    'prescription_type', COALESCE(v_rx.prescription_type, ''),
    'medications', COALESCE(v_rx.medications, ''),
    'instructions', COALESCE(v_rx.instructions, ''),
    'issued_at', COALESCE(v_rx.issued_at::TEXT, ''),
    'validity_days', COALESCE(v_rx.validity_days, 0),
    'patient_id', COALESCE(v_rx.patient_id::TEXT, ''),
    'professional_id', COALESCE(v_rx.professional_id::TEXT, '')
  )::TEXT;

  v_hash := encode(sha256(v_payload::bytea), 'hex');
  
  RETURN v_hash;
END;
$$;


-- ============================================
-- Function: sign_prescription
-- Source: 20260331000000_prescriptions_signature_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.sign_prescription(
  p_prescription_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rx RECORD;
  v_profile RECORD;
  v_hash TEXT;
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.get_user_tenant_id(v_user_id);
  
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não vinculado a uma clínica');
  END IF;

  SELECT * INTO v_rx
  FROM public.prescriptions
  WHERE id = p_prescription_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receita não encontrada');
  END IF;

  IF v_rx.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receita já foi assinada digitalmente');
  END IF;

  SELECT full_name, council_number, council_state INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR v_profile.full_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil do profissional não encontrado');
  END IF;

  IF v_profile.council_number IS NULL OR v_profile.council_number = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CRM é obrigatório para assinatura digital');
  END IF;

  v_hash := public.generate_prescription_hash(p_prescription_id);

  UPDATE public.prescriptions
  SET 
    digital_signature = v_hash,
    digital_hash = v_hash,
    content_hash = v_hash,
    signed_at = NOW(),
    signed_by_name = v_profile.full_name,
    signed_by_crm = v_profile.council_number,
    signed_by_uf = v_profile.council_state,
    updated_at = NOW()
  WHERE id = p_prescription_id;

  RETURN jsonb_build_object(
    'success', true,
    'hash', v_hash,
    'signed_at', NOW()::TEXT,
    'signed_by', v_profile.full_name,
    'crm', v_profile.council_number
  );
END;
$$;


-- ============================================
-- Function: protect_signed_prescription
-- Source: 20260331000000_prescriptions_signature_fields_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.protect_signed_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL THEN
    IF NEW.medications != OLD.medications 
       OR NEW.instructions IS DISTINCT FROM OLD.instructions
       OR NEW.prescription_type != OLD.prescription_type
       OR NEW.validity_days IS DISTINCT FROM OLD.validity_days
    THEN
      RAISE EXCEPTION 'Não é permitido alterar o conteúdo de uma receita assinada digitalmente.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: patient_upload_exam
-- Source: 20260616000000_patient_exam_uploads_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_upload_exam(
  p_file_name   TEXT,
  p_file_path   TEXT,
  p_file_size   BIGINT,
  p_mime_type   TEXT,
  p_exam_name   TEXT DEFAULT '',
  p_exam_date   DATE DEFAULT NULL,
  p_notes       TEXT DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_link RECORD;
  v_id   uuid;
BEGIN
  -- Get the first active patient link (tenant + patient_id)
  SELECT pp.tenant_id, pp.client_id
    INTO v_link
    FROM public.patient_profiles pp
   WHERE pp.user_id = v_uid
     AND pp.is_active = true
   LIMIT 1;

  IF v_link IS NULL THEN
    RAISE EXCEPTION 'patient_not_linked';
  END IF;

  INSERT INTO public.patient_uploaded_exams (
    tenant_id, patient_id, user_id,
    file_name, file_path, file_size, mime_type,
    exam_name, exam_date, notes
  ) VALUES (
    v_link.tenant_id, v_link.client_id, v_uid,
    p_file_name, p_file_path, p_file_size, p_mime_type,
    p_exam_name, p_exam_date, p_notes
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'success', true);
END;
$$;


-- ============================================
-- Function: get_patient_uploaded_exams
-- Source: 20260616000000_patient_exam_uploads_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_patient_uploaded_exams()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
    SELECT jsonb_build_object(
      'id', pue.id,
      'file_name', pue.file_name,
      'file_path', pue.file_path,
      'file_size', pue.file_size,
      'mime_type', pue.mime_type,
      'exam_name', pue.exam_name,
      'exam_date', pue.exam_date,
      'notes', pue.notes,
      'status', pue.status,
      'reviewed_by_name', COALESCE(pr.full_name, ''),
      'reviewed_at', pue.reviewed_at,
      'created_at', pue.created_at,
      'clinic_name', COALESCE(t.name, '')
    )
    FROM public.patient_uploaded_exams pue
    LEFT JOIN public.profiles pr ON pr.id = pue.reviewed_by
    LEFT JOIN public.tenants t ON t.id = pue.tenant_id
    WHERE pue.user_id = v_uid
    ORDER BY pue.created_at DESC;
END;
$$;


-- ============================================
-- Function: patient_delete_uploaded_exam
-- Source: 20260616000000_patient_exam_uploads_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_delete_uploaded_exam(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_path TEXT;
BEGIN
  SELECT file_path INTO v_path
    FROM public.patient_uploaded_exams
   WHERE id = p_exam_id AND user_id = v_uid AND status = 'pendente';

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'exam_not_found_or_already_reviewed';
  END IF;

  DELETE FROM public.patient_uploaded_exams
  WHERE id = p_exam_id AND user_id = v_uid AND status = 'pendente';

  RETURN jsonb_build_object('success', true, 'deleted_path', v_path);
END;
$$;


-- ============================================
-- Function: auto_update_queue_on_triage
-- Source: 20260628700000_consolidate_queue_system.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_update_queue_on_triage()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_queue_priority INTEGER;
  v_priority_label TEXT;
BEGIN
  CASE NEW.priority
    WHEN 'emergencia' THEN v_queue_priority := 1; v_priority_label := 'Emergência';
    WHEN 'urgente' THEN v_queue_priority := 2; v_priority_label := 'Urgente';
    WHEN 'pouco_urgente' THEN v_queue_priority := 4; v_priority_label := 'Pouco Urgente';
    WHEN 'nao_urgente' THEN v_queue_priority := 5; v_priority_label := 'Normal';
    ELSE v_queue_priority := 5; v_priority_label := 'Normal';
  END CASE;

  IF NEW.appointment_id IS NOT NULL THEN
    UPDATE patient_calls SET 
      is_triaged = TRUE, triage_priority = NEW.priority, triage_id = NEW.id,
      priority = LEAST(priority, v_queue_priority),
      priority_label = CASE WHEN v_queue_priority < priority THEN v_priority_label ELSE priority_label END,
      updated_at = NOW()
    WHERE appointment_id = NEW.appointment_id AND tenant_id = NEW.tenant_id
      AND created_at::DATE = CURRENT_DATE AND status IN ('waiting', 'calling');
  ELSE
    UPDATE patient_calls SET 
      is_triaged = TRUE, triage_priority = NEW.priority, triage_id = NEW.id,
      priority = LEAST(priority, v_queue_priority),
      priority_label = CASE WHEN v_queue_priority < priority THEN v_priority_label ELSE priority_label END,
      updated_at = NOW()
    WHERE patient_id = NEW.patient_id AND tenant_id = NEW.tenant_id
      AND created_at::DATE = CURRENT_DATE AND status IN ('waiting', 'calling');
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: trigger_notify_return_scheduled
-- Source: 20260703200000_fix_all_client_id_triggers_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_notify_return_scheduled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_logs (
    tenant_id,
    recipient_type,
    recipient_id,
    channel,
    template_type,
    status,
    metadata
  ) VALUES (
    NEW.tenant_id,
    'patient',
    NEW.patient_id,
    'all',
    'return_scheduled',
    'queued',
    jsonb_build_object(
      'return_id', NEW.id,
      'return_date', NEW.return_date,
      'reason', NEW.reason
    )
  );
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: notify_patient_appointment_confirmed
-- Source: 20260703800000_appointment_confirmed_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_patient_appointment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id UUID;
  v_prof_name TEXT;
  v_clinic_name TEXT;
  v_procedure_name TEXT;
  v_scheduled TEXT;
BEGIN
  -- Só dispara quando status muda para 'confirmed' a partir de 'pending'
  IF NEW.status != 'confirmed' OR OLD.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Buscar user_id do paciente via patient_profiles
  SELECT pp.user_id INTO v_patient_user_id
  FROM public.patient_profiles pp
  WHERE pp.client_id = NEW.patient_id
    AND pp.tenant_id = NEW.tenant_id
    AND pp.is_active = true
  LIMIT 1;

  -- Se o paciente não tem conta no portal, não faz nada
  IF v_patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar dados para a notificação
  SELECT COALESCE(p.full_name, 'Profissional') INTO v_prof_name
  FROM public.profiles p
  WHERE p.id = NEW.professional_id;

  SELECT COALESCE(t.name, 'Clínica') INTO v_clinic_name
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  SELECT COALESCE(proc.name, 'Consulta') INTO v_procedure_name
  FROM public.procedures proc
  WHERE proc.id = NEW.procedure_id;

  v_scheduled := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');

  -- Inserir notificação no portal do paciente
  INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)
  VALUES (
    v_patient_user_id,
    'appointment_confirmed',
    'Agendamento confirmado! ✅',
    format('Seu agendamento de %s com %s em %s foi confirmado pela clínica %s.',
      v_procedure_name, v_prof_name, v_scheduled, v_clinic_name
    ),
    jsonb_build_object(
      'appointment_id', NEW.id,
      'procedure_name', v_procedure_name,
      'professional_name', v_prof_name,
      'clinic_name', v_clinic_name,
      'scheduled_at', NEW.scheduled_at
    )
  );

  RAISE LOG 'notify_patient_appointment_confirmed: patient_user=% appointment=%', v_patient_user_id, NEW.id;
  RETURN NEW;
END;
$$;


-- ============================================
-- Function: notify_waitlist_on_cancellation
-- Source: 20260704500000_waitlist_auto_notify_on_cancel.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_at     timestamptz;
  v_service_id       uuid;
  v_professional_id  uuid;
  v_tenant_id        uuid;
  v_cancelled_period text;
  v_hour             int;
  v_entry            record;
  v_link             text;
BEGIN
  -- Only fire when status changes TO 'cancelled'
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_cancelled_at    := NEW.scheduled_at;
  v_service_id      := NEW.service_id;
  v_professional_id := NEW.professional_id;
  v_tenant_id       := NEW.tenant_id;

  -- Determine period from the cancelled appointment time
  v_hour := EXTRACT(HOUR FROM v_cancelled_at AT TIME ZONE 'America/Sao_Paulo');
  IF v_hour < 12 THEN
    v_cancelled_period := 'manha';
  ELSIF v_hour < 18 THEN
    v_cancelled_period := 'tarde';
  ELSE
    v_cancelled_period := 'noite';
  END IF;

  -- Find up to 3 compatible waitlist entries, ordered by priority then creation date
  FOR v_entry IN
    SELECT w.id, w.patient_id
    FROM waitlist w
    WHERE w.tenant_id = v_tenant_id
      AND w.status = 'aguardando'
      AND (w.service_id IS NULL OR w.service_id = v_service_id)
      AND (w.professional_id IS NULL OR w.professional_id = v_professional_id)
      AND (
        w.preferred_periods IS NULL
        OR cardinality(w.preferred_periods) = 0
        OR v_cancelled_period = ANY(w.preferred_periods)
      )
    ORDER BY
      CASE w.priority
        WHEN 'urgente' THEN 1
        WHEN 'alta'    THEN 2
        ELSE 3
      END,
      w.created_at ASC
    LIMIT 3
  LOOP
    -- Update waitlist entry status
    UPDATE waitlist
    SET status = 'notificado',
        notified_at = NOW(),
        updated_at = NOW()
    WHERE id = v_entry.id;

    -- Insert a notification for the patient (will be picked up by notify-patient-events)
    INSERT INTO notifications (
      user_id,
      tenant_id,
      type,
      title,
      message,
      metadata
    )
    SELECT
      pp.user_id,
      v_tenant_id,
      'waitlist_slot_available',
      'Vaga disponível!',
      'Uma vaga ficou disponível para o serviço que você aguardava. Acesse o app para agendar.',
      jsonb_build_object(
        'waitlist_id', v_entry.id,
        'appointment_date', v_cancelled_at::text,
        'service_id', v_service_id,
        'professional_id', v_professional_id,
        'period', v_cancelled_period
      )
    FROM patient_profiles pp
    WHERE pp.patient_id = v_entry.patient_id
    LIMIT 1;

    -- Insert into automation dispatch queue for WhatsApp/email
    -- The automation-worker will pick this up on next cron run
    INSERT INTO waitlist_notifications (
      tenant_id,
      waitlist_id,
      patient_id,
      appointment_date,
      service_id,
      professional_id,
      period,
      status
    ) VALUES (
      v_tenant_id,
      v_entry.id,
      v_entry.patient_id,
      v_cancelled_at,
      v_service_id,
      v_professional_id,
      v_cancelled_period,
      'pending'
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_preconsultation_form_for_appointment
-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_preconsultation_form_for_appointment(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_service_id  uuid;
  v_form        jsonb;
  v_already     boolean;
BEGIN
  SELECT a.tenant_id, a.service_id
  INTO v_tenant_id, v_service_id
  FROM appointments a
  WHERE a.id = p_appointment_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Verifica se tenant tem pré-consulta habilitada
  IF NOT (SELECT COALESCE(t.pre_consultation_enabled, false) FROM tenants t WHERE t.id = v_tenant_id) THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Verifica se já respondeu
  SELECT EXISTS(
    SELECT 1 FROM pre_consultation_responses r WHERE r.appointment_id = p_appointment_id
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('found', false, 'already_submitted', true);
  END IF;

  -- Busca formulário: primeiro específico ao serviço, senão genérico
  SELECT jsonb_build_object(
    'id', f.id,
    'name', f.name,
    'description', f.description,
    'fields', f.fields
  ) INTO v_form
  FROM pre_consultation_forms f
  WHERE f.tenant_id = v_tenant_id
    AND f.is_active = true
    AND (f.service_id = v_service_id OR f.service_id IS NULL)
  ORDER BY
    CASE WHEN f.service_id = v_service_id THEN 0 ELSE 1 END,
    f.created_at DESC
  LIMIT 1;

  IF v_form IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object('found', true, 'form', v_form);
END;
$$;


-- ============================================
-- Function: auto_release_unconfirmed_appointments
-- Source: 20260704600000_phase2_checkin_smart_confirmation.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_release_unconfirmed_appointments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_appt  record;
BEGIN
  FOR v_appt IN
    SELECT a.id, a.tenant_id, a.service_id, a.professional_id, a.scheduled_at, a.patient_id
    FROM appointments a
    JOIN tenants t ON t.id = a.tenant_id
    WHERE t.smart_confirmation_enabled = true
      AND a.status IN ('pending')
      AND a.confirmed_at IS NULL
      AND a.confirmation_sent_4h = true
      AND a.confirmation_sent_1h = true
      AND a.scheduled_at <= NOW() + (t.smart_confirmation_autorelease_minutes || ' minutes')::interval
      AND a.scheduled_at > NOW()
      AND a.confirmation_auto_released = false
  LOOP
    -- Cancela o agendamento
    UPDATE appointments
    SET status = 'cancelled',
        confirmation_auto_released = true,
        notes = COALESCE(notes, '') || E'\n[Auto-liberado: paciente não confirmou presença]',
        updated_at = NOW()
    WHERE id = v_appt.id;

    -- Notifica internamente
    INSERT INTO notifications (user_id, tenant_id, type, title, message, data)
    SELECT
      p.user_id,
      v_appt.tenant_id,
      'appointment_auto_released',
      'Vaga auto-liberada',
      'Paciente não confirmou e a vaga foi liberada automaticamente.',
      jsonb_build_object('appointment_id', v_appt.id, 'scheduled_at', v_appt.scheduled_at::text)
    FROM profiles p
    WHERE p.id = v_appt.professional_id AND p.user_id IS NOT NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('released', v_count);
END;
$$;

