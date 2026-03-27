-- ============================================================================
-- APLICAR ESTA MIGRATION NO SUPABASE SQL EDITOR
-- ============================================================================
-- Este arquivo restaura a integração entre commission_rules e o backend.
-- O migration 20260628200000 acidentalmente removeu toda a lógica de comissão
-- ao corrigir nomes de colunas (procedure_id/patient_id).
--
-- O QUE FAZ:
-- 1. Adiciona 'referral' ao enum commission_rule_type
-- 2. Recria get_applicable_commission_rule (corrige service_id → procedure_id)
-- 3. Recria calculate_commission_amount (garante existência)
-- 4. Recria complete_appointment_with_sale COM lógica de comissão integrada
--    - Prioridade: commission_rules → fallback professional_commissions
-- 5. Atualiza grants para authenticated + service_role
-- ============================================================================

-- Cole o conteúdo do arquivo:
-- supabase/migrations/20260703950000_restore_commission_integration.sql

-- ─── 1. Adicionar 'referral' ao enum commission_rule_type ───────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'referral'
    AND enumtypid = 'public.commission_rule_type'::regtype
  ) THEN
    ALTER TYPE public.commission_rule_type ADD VALUE 'referral';
  END IF;
END $$;

-- ─── 2. Recriar get_applicable_commission_rule (service_id → procedure_id) ──

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
          (cr.rule_type = 'procedure' AND cr.procedure_code = p_procedure_code AND p_procedure_code IS NOT NULL)
          OR
          (cr.rule_type = 'service' AND cr.procedure_id = p_procedure_id AND p_procedure_id IS NOT NULL)
          OR
          (cr.rule_type = 'insurance' AND cr.insurance_id = p_insurance_id AND p_insurance_id IS NOT NULL)
          OR
          (cr.rule_type = 'default')
      )
    ORDER BY cr.priority DESC, cr.created_at DESC
    LIMIT 1;
END;
$$;

-- ─── 3. Recriar calculate_commission_amount ─────────────────────────────────

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
        v_applicable_rate := p_value;

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

-- ─── 4. Recriar complete_appointment_with_sale COM comissão ─────────────────

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
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_quantity IS NOT NULL AND p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade de produto não pode ser negativa';
  END IF;

  IF p_product_id IS NOT NULL AND (p_quantity IS NULL OR p_quantity <= 0) THEN
    RAISE EXCEPTION 'Quantidade de produto deve ser maior que zero quando houver produto';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_appointment_id::text), hashtext('complete_appointment_with_sale'));

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
      tenant_id, product_id, quantity, movement_type, out_reason_type, reason, created_by
    ) VALUES (
      v_tenant_id, p_product_id, -p_quantity, 'out', 'sale',
      COALESCE('Venda durante o procedimento ' || v_appointment.service_name, 'Venda durante atendimento'),
      v_requester_profile_id
    );

    UPDATE public.products
    SET quantity = quantity - p_quantity
    WHERE id = p_product_id AND tenant_id = v_tenant_id;

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

  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id
    AND status <> 'completed';

  -- ========== CÁLCULO DE COMISSÃO ==========
  IF v_professional_user_id IS NULL THEN
    v_commission_reason := 'missing_professional_user_id';
  ELSE
    SELECT * INTO v_commission_rule
    FROM public.get_applicable_commission_rule(
      v_tenant_id,
      v_professional_user_id,
      v_appointment.procedure_id,
      v_appointment.insurance_plan_id,
      NULL
    );

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

    IF v_commission_rule IS NULL OR v_commission_rule.value IS NULL OR v_commission_rule.value <= 0 THEN
      v_commission_reason := 'missing_config';
    ELSE
      IF v_commission_rule.calculation_type = 'tiered' THEN
        SELECT COALESCE(SUM(cp.service_price), 0)
        INTO v_monthly_revenue
        FROM public.commission_payments cp
        WHERE cp.professional_id = v_professional_user_id
          AND cp.tenant_id = v_tenant_id
          AND date_trunc('month', cp.created_at) = date_trunc('month', now());
      END IF;

      v_commission_amount := public.calculate_commission_amount(
        v_commission_rule.calculation_type,
        v_commission_rule.value,
        v_commission_rule.tier_config,
        v_service_price,
        v_monthly_revenue
      );

      IF v_appointment.commission_amount IS NOT NULL AND v_appointment.commission_amount > 0 THEN
        v_commission_amount := v_appointment.commission_amount;
      END IF;

      IF v_commission_amount <= 0 THEN
        v_commission_reason := 'amount_zero';
      ELSE
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

GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(uuid, uuid, integer) TO service_role;

-- ─── 5. Grants ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_applicable_commission_rule(UUID, UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_applicable_commission_rule(UUID, UUID, UUID, UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.calculate_commission_amount(public.commission_calculation_type, DECIMAL, JSONB, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_commission_amount(public.commission_calculation_type, DECIMAL, JSONB, DECIMAL, DECIMAL) TO service_role;
