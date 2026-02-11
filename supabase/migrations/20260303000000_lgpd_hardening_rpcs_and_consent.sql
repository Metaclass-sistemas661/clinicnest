-- =====================================================
-- LGPD hardening: RPC authorization + explicit consent data
-- =====================================================

-- -----------------------------------------------------
-- 1) Harden complete_appointment_with_sale
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_appointment_with_sale(
  p_appointment_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
  v_requester_tenant_id UUID;
  v_requester_profile_id UUID;
  v_requester_is_admin BOOLEAN := FALSE;

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

  SELECT p.tenant_id, p.id
  INTO v_requester_tenant_id, v_requester_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_requester_user_id
  LIMIT 1;

  IF v_requester_tenant_id IS NULL OR v_requester_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado';
  END IF;

  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, v_requester_tenant_id);

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
    AND a.tenant_id = v_requester_tenant_id
  LIMIT 1;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_appointment.status = 'completed' THEN
    RAISE EXCEPTION 'Agendamento já foi concluído';
  END IF;

  IF NOT v_requester_is_admin
     AND v_appointment.professional_id IS DISTINCT FROM v_requester_profile_id THEN
    RAISE EXCEPTION 'Sem permissão para concluir este agendamento';
  END IF;

  v_service_price := COALESCE(v_appointment.effective_price, 0);

  -- Venda de produto opcional
  IF p_product_id IS NOT NULL THEN
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
      AND tenant_id = v_requester_tenant_id
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
      v_requester_tenant_id,
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
      AND tenant_id = v_requester_tenant_id;

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
      v_requester_tenant_id,
      'income',
      'Venda de Produto',
      v_product_revenue,
      v_description,
      CURRENT_DATE,
      p_product_id,
      p_appointment_id
    );
  END IF;

  UPDATE public.appointments
  SET status = 'completed', updated_at = now()
  WHERE id = p_appointment_id
    AND tenant_id = v_requester_tenant_id;

  IF v_appointment.professional_id IS NOT NULL THEN
    SELECT p.user_id, p.full_name
    INTO v_professional_user_id, v_professional_name
    FROM public.profiles p
    WHERE p.id = v_appointment.professional_id
      AND p.tenant_id = v_requester_tenant_id
    LIMIT 1;
  END IF;

  -- Comissão
  IF v_professional_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.commission_payments cp WHERE cp.appointment_id = p_appointment_id) THEN
    SELECT pc.*
    INTO v_commission_config
    FROM public.professional_commissions pc
    WHERE pc.user_id = v_professional_user_id
      AND pc.tenant_id = v_requester_tenant_id
      AND (pc.payment_type IS NULL OR pc.payment_type = 'commission')
    LIMIT 1;

    IF v_appointment.commission_amount IS NOT NULL AND v_appointment.commission_amount > 0 THEN
      v_commission_amount := v_appointment.commission_amount;
      v_config_type := 'fixed';
    ELSIF v_commission_config IS NOT NULL AND COALESCE(v_commission_config.value, 0) > 0 THEN
      v_config_type := LOWER(COALESCE(v_commission_config.type::text, ''));
      IF v_config_type = 'percentage' THEN
        v_commission_amount := (v_service_price * v_commission_config.value) / 100;
      ELSE
        v_commission_amount := v_commission_config.value;
      END IF;
    END IF;

    IF v_commission_amount > 0 THEN
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
        v_requester_tenant_id,
        v_professional_user_id,
        p_appointment_id,
        CASE
          WHEN v_commission_config IS NOT NULL THEN v_commission_config.id
          ELSE NULL
        END,
        v_commission_amount,
        v_service_price,
        CASE
          WHEN v_config_type = 'percentage' THEN 'percentage'::public.commission_type
          ELSE 'fixed'::public.commission_type
        END,
        CASE
          WHEN v_appointment.commission_amount IS NOT NULL AND v_appointment.commission_amount > 0 THEN v_appointment.commission_amount
          WHEN v_commission_config IS NOT NULL THEN COALESCE(v_commission_config.value, v_commission_amount)
          ELSE v_commission_amount
        END,
        'pending',
        'Comissão por ' || COALESCE(v_appointment.service_name, 'serviço')
      );
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
    v_requester_tenant_id,
    p_appointment_id,
    COALESCE(v_professional_name, ''),
    COALESCE(v_appointment.service_name, 'Serviço'),
    v_service_profit,
    v_product_sales,
    v_product_profit,
    v_total_profit
  );

  RETURN jsonb_build_object(
    'commission_amount', (COALESCE(v_commission_amount, 0))::float,
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

REVOKE ALL ON FUNCTION public.complete_appointment_with_sale(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_with_sale(UUID, UUID, INTEGER) TO service_role;

-- -----------------------------------------------------
-- 2) Harden salary RPCs
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS public.pay_salary(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT);

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
  v_requester_user_id UUID := auth.uid();
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
  v_requester_user_id UUID := auth.uid();
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

CREATE OR REPLACE FUNCTION public.get_professionals_with_salary(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
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

REVOKE ALL ON FUNCTION public.pay_salary(UUID, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_salary_payments(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_professionals_with_salary(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.pay_salary(UUID, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_salary(UUID, INTEGER, INTEGER, TEXT, INTEGER, TEXT, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_salary_payments(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_salary_payments(UUID, UUID, INTEGER, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_professionals_with_salary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_professionals_with_salary(UUID) TO service_role;

-- -----------------------------------------------------
-- 3) Harden goals RPC exposed to frontend
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS public.get_goals_with_progress(UUID);

CREATE OR REPLACE FUNCTION public.get_goals_with_progress(
  p_tenant_id UUID,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  goal_type TEXT,
  target_value DECIMAL,
  period TEXT,
  professional_id UUID,
  product_id UUID,
  show_in_header BOOLEAN,
  header_priority INT,
  custom_start DATE,
  custom_end DATE,
  archived_at TIMESTAMPTZ,
  current_value DECIMAL,
  progress_pct DECIMAL,
  days_remaining INT,
  period_elapsed_pct DECIMAL,
  projected_reach TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id UUID := auth.uid();
  v_goal RECORD;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_current DECIMAL(15,2);
  v_days_total INT;
  v_days_elapsed INT;
  v_days_left INT;
  v_elapsed_pct DECIMAL(5,2);
  v_projected TEXT;
  v_sum DECIMAL(15,2);
  v_cnt INT;
  v_progress DECIMAL;
  v_required_pace DECIMAL;
BEGIN
  IF v_requester_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = v_requester_user_id
      AND p.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  FOR v_goal IN
    SELECT g.id, g.name, g.goal_type::text, g.target_value, g.period::text,
           g.professional_id, g.product_id, g.show_in_header,
           COALESCE(g.header_priority, 0) as header_priority,
           g.custom_start, g.custom_end, g.archived_at
    FROM public.goals g
    WHERE g.tenant_id = p_tenant_id
      AND g.is_active = true
      AND (p_include_archived = true OR g.archived_at IS NULL)
  LOOP
    v_current := 0;
    v_days_total := 30;
    v_days_elapsed := 0;
    v_days_left := 0;
    v_elapsed_pct := 0;
    v_projected := 'Indefinido';

    IF v_goal.custom_start IS NOT NULL AND v_goal.custom_end IS NOT NULL THEN
      v_start := v_goal.custom_start::timestamptz;
      v_end := (v_goal.custom_end + interval '1 day')::timestamptz;
    ELSE
      CASE v_goal.period
        WHEN 'weekly' THEN
          v_start := date_trunc('week', CURRENT_DATE)::timestamptz;
          v_end := v_start + interval '7 days';
        WHEN 'monthly' THEN
          v_start := date_trunc('month', CURRENT_DATE)::timestamptz;
          v_end := date_trunc('month', CURRENT_DATE) + interval '1 month';
        WHEN 'quarterly' THEN
          v_start := date_trunc('quarter', CURRENT_DATE)::timestamptz;
          v_end := v_start + interval '3 months';
        WHEN 'yearly' THEN
          v_start := date_trunc('year', CURRENT_DATE)::timestamptz;
          v_end := date_trunc('year', CURRENT_DATE) + interval '1 year';
        ELSE
          v_start := date_trunc('month', CURRENT_DATE)::timestamptz;
          v_end := date_trunc('month', CURRENT_DATE) + interval '1 month';
      END CASE;
    END IF;

    v_days_total := GREATEST(1, EXTRACT(EPOCH FROM (v_end - v_start)) / 86400)::int;
    v_days_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_start)) / 86400)::int;
    v_days_left := GREATEST(0, EXTRACT(EPOCH FROM (v_end - CURRENT_TIMESTAMP)) / 86400)::int;
    v_elapsed_pct := LEAST(100, (v_days_elapsed::decimal / v_days_total) * 100);

    CASE v_goal.goal_type
      WHEN 'revenue' THEN
        IF v_goal.professional_id IS NULL THEN
          SELECT COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.transaction_date >= v_start::date AND ft.transaction_date < v_end::date;
          IF v_current = 0 OR v_current IS NULL THEN
            SELECT COALESCE(SUM(a.price), 0) INTO v_current
            FROM public.appointments a
            WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
              AND a.scheduled_at >= v_start AND a.scheduled_at < v_end;
          END IF;
        ELSE
          SELECT COALESCE(SUM(a.price), 0) INTO v_current
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.professional_id = v_goal.professional_id
            AND a.scheduled_at >= v_start AND a.scheduled_at < v_end;
          SELECT v_current + COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          INNER JOIN public.appointments a ON a.id = ft.appointment_id AND a.professional_id = v_goal.professional_id
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.transaction_date >= v_start::date AND ft.transaction_date < v_end::date
            AND ft.appointment_id IS NOT NULL;
        END IF;

      WHEN 'services_count' THEN
        IF v_goal.professional_id IS NULL THEN
          SELECT COALESCE(COUNT(*), 0)::decimal INTO v_current
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.scheduled_at >= v_start AND a.scheduled_at < v_end;
        ELSE
          SELECT COALESCE(COUNT(*), 0)::decimal INTO v_current
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.professional_id = v_goal.professional_id
            AND a.scheduled_at >= v_start AND a.scheduled_at < v_end;
        END IF;

      WHEN 'product_quantity' THEN
        IF v_goal.product_id IS NULL THEN
          SELECT COALESCE(SUM(ABS(sm.quantity)), 0) INTO v_current
          FROM public.stock_movements sm
          WHERE sm.tenant_id = p_tenant_id AND sm.movement_type = 'out'
            AND sm.out_reason_type = 'sale'
            AND sm.created_at >= v_start AND sm.created_at < v_end;
        ELSE
          SELECT COALESCE(SUM(ABS(sm.quantity)), 0) INTO v_current
          FROM public.stock_movements sm
          WHERE sm.tenant_id = p_tenant_id AND sm.product_id = v_goal.product_id
            AND sm.movement_type = 'out' AND sm.out_reason_type = 'sale'
            AND sm.created_at >= v_start AND sm.created_at < v_end;
        END IF;

      WHEN 'product_revenue' THEN
        IF v_goal.product_id IS NULL THEN
          SELECT COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.category = 'Venda de Produto'
            AND ft.transaction_date >= v_start::date AND ft.transaction_date < v_end::date;
        ELSE
          SELECT COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.category = 'Venda de Produto' AND ft.product_id = v_goal.product_id
            AND ft.transaction_date >= v_start::date AND ft.transaction_date < v_end::date;
        END IF;

      WHEN 'clientes_novos' THEN
        IF v_goal.professional_id IS NULL THEN
          SELECT COALESCE(COUNT(*), 0)::decimal INTO v_current
          FROM (
            SELECT DISTINCT a.client_id
            FROM public.appointments a
            WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
              AND a.scheduled_at >= v_start AND a.scheduled_at < v_end
              AND a.client_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.appointments a2
                WHERE a2.tenant_id = p_tenant_id AND a2.client_id = a.client_id
                  AND a2.status = 'completed' AND a2.scheduled_at < v_start
              )
          ) sub;
        ELSE
          SELECT COALESCE(COUNT(*), 0)::decimal INTO v_current
          FROM (
            SELECT DISTINCT a.client_id
            FROM public.appointments a
            WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
              AND a.professional_id = v_goal.professional_id
              AND a.scheduled_at >= v_start AND a.scheduled_at < v_end
              AND a.client_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.appointments a2
                WHERE a2.tenant_id = p_tenant_id AND a2.client_id = a.client_id
                  AND a2.professional_id = v_goal.professional_id
                  AND a2.status = 'completed' AND a2.scheduled_at < v_start
              )
          ) sub;
        END IF;

      WHEN 'ticket_medio' THEN
        IF v_goal.professional_id IS NULL THEN
          SELECT COALESCE(SUM(a.price), 0), COALESCE(COUNT(*), 0) INTO v_sum, v_cnt
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.scheduled_at >= v_start AND a.scheduled_at < v_end;
        ELSE
          SELECT COALESCE(SUM(a.price), 0), COALESCE(COUNT(*), 0) INTO v_sum, v_cnt
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.professional_id = v_goal.professional_id
            AND a.scheduled_at >= v_start AND a.scheduled_at < v_end;
        END IF;
        v_current := CASE WHEN v_cnt > 0 THEN v_sum / v_cnt ELSE 0 END;

      ELSE
        v_current := 0;
    END CASE;

    IF COALESCE(v_current, 0) >= v_goal.target_value THEN
      v_projected := 'Meta atingida!';
    ELSIF v_elapsed_pct > 0 AND v_elapsed_pct < 100 AND v_goal.target_value > 0 THEN
      v_progress := (COALESCE(v_current, 0) / v_goal.target_value) * 100;
      v_required_pace := v_elapsed_pct;
      IF v_progress >= v_required_pace * 0.9 THEN
        v_projected := 'No prazo';
      ELSIF v_progress >= v_required_pace * 0.7 THEN
        v_projected := 'Atenção';
      ELSE
        v_projected := 'Atrasado';
      END IF;
    END IF;

    id := v_goal.id;
    name := v_goal.name;
    goal_type := v_goal.goal_type;
    target_value := v_goal.target_value;
    period := v_goal.period;
    professional_id := v_goal.professional_id;
    product_id := v_goal.product_id;
    show_in_header := COALESCE(v_goal.show_in_header, v_goal.header_priority > 0);
    header_priority := COALESCE(v_goal.header_priority, 0);
    custom_start := v_goal.custom_start;
    custom_end := v_goal.custom_end;
    archived_at := v_goal.archived_at;
    current_value := COALESCE(v_current, 0);
    progress_pct := CASE
      WHEN v_goal.target_value > 0 THEN LEAST(100, (COALESCE(v_current, 0) / v_goal.target_value) * 100)
      ELSE 0
    END;
    days_remaining := v_days_left;
    period_elapsed_pct := v_elapsed_pct;
    projected_reach := v_projected;
    period_start := v_start;
    period_end := v_end;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_goals_with_progress(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_goals_with_progress(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_goals_with_progress(UUID, BOOLEAN) TO service_role;

-- -----------------------------------------------------
-- 4) Reduce attack surface for currently unused RPCs
-- -----------------------------------------------------
REVOKE ALL ON FUNCTION public.get_goal_progress_history(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_goal_previous_period_value(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_achievements_summary(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_goal_achievements_for_tenant(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_streak_achievements(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_level_achievements(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_goal_progress_history(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_goal_previous_period_value(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_achievements_summary(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_goal_achievements_for_tenant(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_streak_achievements(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_level_achievements(UUID) TO service_role;

-- -----------------------------------------------------
-- 5) Explicit consent fields in contact form storage
-- -----------------------------------------------------
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_messages;

CREATE POLICY "Anyone can submit contact form"
  ON public.contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (
    terms_accepted = true
    AND privacy_accepted = true
    AND consented_at IS NOT NULL
  );
