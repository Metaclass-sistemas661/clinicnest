-- Função para obter metas com progresso atual

CREATE OR REPLACE FUNCTION public.get_goals_with_progress(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  goal_type TEXT,
  target_value DECIMAL,
  period TEXT,
  professional_id UUID,
  product_id UUID,
  show_in_header BOOLEAN,
  current_value DECIMAL,
  progress_pct DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal RECORD;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_current DECIMAL(15,2);
BEGIN
  FOR v_goal IN
    SELECT g.id, g.name, g.goal_type::text, g.target_value, g.period::text,
           g.professional_id, g.product_id, g.show_in_header
    FROM public.goals g
    WHERE g.tenant_id = p_tenant_id AND g.is_active = true
  LOOP
    v_current := 0;

    -- Período atual
    CASE v_goal.period
      WHEN 'weekly' THEN
        v_start := date_trunc('week', CURRENT_DATE)::timestamptz;
        v_end := v_start + interval '7 days';
      WHEN 'monthly' THEN
        v_start := date_trunc('month', CURRENT_DATE)::timestamptz;
        v_end := date_trunc('month', CURRENT_DATE) + interval '1 month';
      WHEN 'yearly' THEN
        v_start := date_trunc('year', CURRENT_DATE)::timestamptz;
        v_end := date_trunc('year', CURRENT_DATE) + interval '1 year';
      ELSE
        v_start := date_trunc('month', CURRENT_DATE)::timestamptz;
        v_end := date_trunc('month', CURRENT_DATE) + interval '1 month';
    END CASE;

    -- Calcular valor atual conforme tipo
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

      ELSE
        v_current := 0;
    END CASE;

    id := v_goal.id;
    name := v_goal.name;
    goal_type := v_goal.goal_type;
    target_value := v_goal.target_value;
    period := v_goal.period;
    professional_id := v_goal.professional_id;
    product_id := v_goal.product_id;
    show_in_header := v_goal.show_in_header;
    current_value := COALESCE(v_current, 0);
    progress_pct := CASE WHEN v_goal.target_value > 0
      THEN LEAST(100, (COALESCE(v_current, 0) / v_goal.target_value) * 100)
      ELSE 0 END;
    RETURN NEXT;
  END LOOP;
END;
$$;
