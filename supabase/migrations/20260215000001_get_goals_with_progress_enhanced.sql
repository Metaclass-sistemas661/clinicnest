-- Função aprimorada: metas com progresso, dias restantes, projeção, custom range

CREATE OR REPLACE FUNCTION public.get_goals_with_progress(p_tenant_id UUID, p_include_archived BOOLEAN DEFAULT false)
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

    -- Período
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

    -- Projeção: atingirá a meta?
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
    progress_pct := CASE WHEN v_goal.target_value > 0
      THEN LEAST(100, (COALESCE(v_current, 0) / v_goal.target_value) * 100)
      ELSE 0 END;
    days_remaining := v_days_left;
    period_elapsed_pct := v_elapsed_pct;
    projected_reach := v_projected;
    period_start := v_start;
    period_end := v_end;
    RETURN NEXT;
  END LOOP;
END;
$$;
