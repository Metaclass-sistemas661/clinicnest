-- GCP Migration: Functions - crm_loyalty
-- Total: 33 functions


-- ============================================
-- Function: get_goals_with_progress
-- Source: 20260303000000_lgpd_hardening_rpcs_and_consent.sql
-- ============================================
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


-- ============================================
-- Function: get_goal_progress_history
-- Source: 20260215000002_goal_progress_history_and_previous.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_goal_progress_history(
  p_goal_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE (
  day_date DATE,
  cumulative_value DECIMAL,
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
  v_target DECIMAL(15,2);
  v_current DECIMAL(15,2);
  v_date DATE;
BEGIN
  SELECT g.id, g.goal_type, g.target_value, g.period, g.professional_id, g.product_id,
         g.custom_start, g.custom_end
  INTO v_goal
  FROM public.goals g
  WHERE g.id = p_goal_id AND g.tenant_id = p_tenant_id AND g.is_active = true;

  IF v_goal.id IS NULL THEN RETURN; END IF;

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

  v_target := v_goal.target_value;
  v_date := v_start::date;

  WHILE v_date <= LEAST(CURRENT_DATE, (v_end - interval '1 day')::date) LOOP
    v_current := 0;

    CASE v_goal.goal_type
      WHEN 'revenue' THEN
        IF v_goal.professional_id IS NULL THEN
          SELECT COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.transaction_date >= v_start::date AND ft.transaction_date <= v_date;
          IF v_current = 0 OR v_current IS NULL THEN
            SELECT COALESCE(SUM(a.price), 0) INTO v_current
            FROM public.appointments a
            WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
              AND a.scheduled_at >= v_start AND a.scheduled_at < (v_date + interval '1 day')::timestamptz;
          END IF;
        ELSE
          SELECT COALESCE(SUM(a.price), 0) INTO v_current
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.professional_id = v_goal.professional_id
            AND a.scheduled_at >= v_start AND a.scheduled_at < (v_date + interval '1 day')::timestamptz;
          SELECT v_current + COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          INNER JOIN public.appointments a ON a.id = ft.appointment_id AND a.professional_id = v_goal.professional_id
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.transaction_date >= v_start::date AND ft.transaction_date <= v_date
            AND ft.appointment_id IS NOT NULL;
        END IF;
      WHEN 'services_count' THEN
        IF v_goal.professional_id IS NULL THEN
          SELECT COALESCE(COUNT(*), 0)::decimal INTO v_current
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.scheduled_at >= v_start AND a.scheduled_at < (v_date + interval '1 day')::timestamptz;
        ELSE
          SELECT COALESCE(COUNT(*), 0)::decimal INTO v_current
          FROM public.appointments a
          WHERE a.tenant_id = p_tenant_id AND a.status = 'completed'
            AND a.professional_id = v_goal.professional_id
            AND a.scheduled_at >= v_start AND a.scheduled_at < (v_date + interval '1 day')::timestamptz;
        END IF;
      WHEN 'product_quantity' THEN
        IF v_goal.product_id IS NULL THEN
          SELECT COALESCE(SUM(ABS(sm.quantity)), 0) INTO v_current
          FROM public.stock_movements sm
          WHERE sm.tenant_id = p_tenant_id AND sm.movement_type = 'out'
            AND sm.out_reason_type = 'sale'
            AND sm.created_at >= v_start AND sm.created_at < (v_date + interval '1 day')::timestamptz;
        ELSE
          SELECT COALESCE(SUM(ABS(sm.quantity)), 0) INTO v_current
          FROM public.stock_movements sm
          WHERE sm.tenant_id = p_tenant_id AND sm.product_id = v_goal.product_id
            AND sm.movement_type = 'out' AND sm.out_reason_type = 'sale'
            AND sm.created_at >= v_start AND sm.created_at < (v_date + interval '1 day')::timestamptz;
        END IF;
      WHEN 'product_revenue' THEN
        IF v_goal.product_id IS NULL THEN
          SELECT COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.category = 'Venda de Produto'
            AND ft.transaction_date >= v_start::date AND ft.transaction_date <= v_date;
        ELSE
          SELECT COALESCE(SUM(ft.amount), 0) INTO v_current
          FROM public.financial_transactions ft
          WHERE ft.tenant_id = p_tenant_id AND ft.type = 'income'
            AND ft.category = 'Venda de Produto' AND ft.product_id = v_goal.product_id
            AND ft.transaction_date >= v_start::date AND ft.transaction_date <= v_date;
        END IF;
      ELSE
        v_current := 0;
    END CASE;

    day_date := v_date;
    cumulative_value := COALESCE(v_current, 0);
    progress_pct := CASE WHEN v_target > 0
      THEN LEAST(100, (COALESCE(v_current, 0) / v_target) * 100)
      ELSE 0 END;
    RETURN NEXT;
    v_date := v_date + interval '1 day';
  END LOOP;
END;
$$;


-- ============================================
-- Function: get_goal_previous_period_value
-- Source: 20260215000002_goal_progress_history_and_previous.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_goal_previous_period_value(
  p_goal_id UUID,
  p_tenant_id UUID
)
RETURNS DECIMAL
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
  SELECT g.goal_type, g.target_value, g.period, g.professional_id, g.product_id,
         g.custom_start, g.custom_end
  INTO v_goal
  FROM public.goals g
  WHERE g.id = p_goal_id AND g.tenant_id = p_tenant_id AND g.is_active = true;

  IF v_goal.goal_type IS NULL THEN RETURN 0; END IF;

  -- Período ANTERIOR
  IF v_goal.custom_start IS NOT NULL AND v_goal.custom_end IS NOT NULL THEN
    v_start := (v_goal.custom_start - (v_goal.custom_end - v_goal.custom_start))::timestamptz;
    v_end := v_goal.custom_start::timestamptz;
  ELSE
    CASE v_goal.period
      WHEN 'weekly' THEN
        v_start := date_trunc('week', CURRENT_DATE)::timestamptz - interval '7 days';
        v_end := date_trunc('week', CURRENT_DATE)::timestamptz;
      WHEN 'monthly' THEN
        v_start := date_trunc('month', CURRENT_DATE)::timestamptz - interval '1 month';
        v_end := date_trunc('month', CURRENT_DATE)::timestamptz;
      WHEN 'quarterly' THEN
        v_start := date_trunc('quarter', CURRENT_DATE)::timestamptz - interval '3 months';
        v_end := date_trunc('quarter', CURRENT_DATE)::timestamptz;
      WHEN 'yearly' THEN
        v_start := date_trunc('year', CURRENT_DATE)::timestamptz - interval '1 year';
        v_end := date_trunc('year', CURRENT_DATE)::timestamptz;
      ELSE
        v_start := date_trunc('month', CURRENT_DATE)::timestamptz - interval '1 month';
        v_end := date_trunc('month', CURRENT_DATE)::timestamptz;
    END CASE;
  END IF;

  v_current := 0;

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
    ELSE RETURN 0;
  END CASE;

  RETURN COALESCE(v_current, 0);
END;
$$;


-- ============================================
-- Function: record_goal_achievements_for_tenant
-- Source: 20260216000000_goal_gamification.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.record_goal_achievements_for_tenant(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_inserted INT := 0;
  v_period_start TEXT;
  v_period_end TEXT;
  v_exists BOOLEAN;
BEGIN
  FOR v_rec IN
    SELECT g.id, g.name, g.period, g.professional_id, g.target_value,
           gp.current_value, gp.progress_pct, gp.period_start, gp.period_end
    FROM (
      SELECT * FROM get_goals_with_progress(p_tenant_id, false)
    ) gp
    JOIN goals g ON g.id = gp.id
    WHERE gp.progress_pct >= 100
  LOOP
    v_period_start := COALESCE(v_rec.period_start::text, '');
    v_period_end := COALESCE(v_rec.period_end::text, '');

    -- Verifica se já registrou para este goal + profissional + período
    SELECT EXISTS (
      SELECT 1 FROM goal_achievements
      WHERE tenant_id = p_tenant_id
        AND goal_id = v_rec.id
        AND (professional_id IS NOT DISTINCT FROM v_rec.professional_id)
        AND achievement_type = 'goal_reached'
        AND metadata->>'period_start' = v_period_start
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO goal_achievements (tenant_id, goal_id, professional_id, achievement_type, metadata)
      VALUES (
        p_tenant_id,
        v_rec.id,
        v_rec.professional_id,
        'goal_reached',
        jsonb_build_object(
          'period_start', v_period_start,
          'period_end', v_period_end,
          'target_value', v_rec.target_value,
          'current_value', v_rec.current_value,
          'goal_name', v_rec.name
        )
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- 2. Calcular e registrar streaks (2+ períodos consecutivos)
  PERFORM record_streak_achievements(p_tenant_id);

  -- 3. Calcular e registrar níveis (bronze, prata, ouro)
  PERFORM record_level_achievements(p_tenant_id);

  RETURN v_inserted;
END;
$$;


-- ============================================
-- Function: record_streak_achievements
-- Source: 20260216000000_goal_gamification.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.record_streak_achievements(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_streak_count INT;
BEGIN
  FOR v_rec IN
    SELECT ga.goal_id, ga.professional_id, COUNT(*)::int as cnt
    FROM goal_achievements ga
    WHERE ga.tenant_id = p_tenant_id AND ga.achievement_type = 'goal_reached'
    GROUP BY ga.goal_id, ga.professional_id
    HAVING COUNT(*) >= 2
  LOOP
    v_streak_count := v_rec.cnt;

    -- Remove streak antigo e insere o atualizado (evita duplicados)
    DELETE FROM goal_achievements
    WHERE tenant_id = p_tenant_id AND goal_id = v_rec.goal_id
      AND (professional_id IS NOT DISTINCT FROM v_rec.professional_id)
      AND achievement_type = 'streak';

    INSERT INTO goal_achievements (tenant_id, goal_id, professional_id, achievement_type, metadata)
    VALUES (p_tenant_id, v_rec.goal_id, v_rec.professional_id, 'streak',
            jsonb_build_object('streak_count', v_streak_count));
  END LOOP;
END;
$$;


-- ============================================
-- Function: record_level_achievements
-- Source: 20260216000000_goal_gamification.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.record_level_achievements(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_level TEXT;
  v_total INT;
  v_goal_id UUID;
BEGIN
  SELECT id INTO v_goal_id FROM goals WHERE tenant_id = p_tenant_id AND is_active = true LIMIT 1;
  IF v_goal_id IS NULL THEN RETURN; END IF;

  -- Por profissional (inclui professional_id IS NULL para metas gerais)
  FOR v_rec IN
    SELECT professional_id, COUNT(*)::int as total
    FROM goal_achievements
    WHERE tenant_id = p_tenant_id AND achievement_type = 'goal_reached'
    GROUP BY professional_id
  LOOP
    v_total := v_rec.total;
    v_level := CASE
      WHEN v_total >= 5 THEN 'ouro'
      WHEN v_total >= 3 THEN 'prata'
      WHEN v_total >= 1 THEN 'bronze'
      ELSE NULL
    END;

    IF v_level IS NOT NULL THEN
      DELETE FROM goal_achievements
      WHERE tenant_id = p_tenant_id AND (professional_id IS NOT DISTINCT FROM v_rec.professional_id)
        AND achievement_type = 'level';

      INSERT INTO goal_achievements (tenant_id, goal_id, professional_id, achievement_type, metadata)
      VALUES (p_tenant_id, v_goal_id, v_rec.professional_id, 'level',
              jsonb_build_object('level', v_level, 'total_goals_reached', v_total));
    END IF;
  END LOOP;
END;
$$;


-- ============================================
-- Function: get_achievements_summary
-- Source: 20260216000000_goal_gamification.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_achievements_summary(
  p_tenant_id UUID,
  p_professional_id UUID DEFAULT NULL
)
RETURNS TABLE (
  achievement_type TEXT,
  goal_id UUID,
  goal_name TEXT,
  professional_id UUID,
  professional_name TEXT,
  achieved_at TIMESTAMPTZ,
  metadata JSONB,
  level_name TEXT,
  streak_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.achievement_type,
    ga.goal_id,
    COALESCE((ga.metadata->>'goal_name')::text, g.name) as goal_name,
    ga.professional_id,
    p.full_name as professional_name,
    ga.achieved_at,
    ga.metadata,
    CASE ga.achievement_type
      WHEN 'level' THEN ga.metadata->>'level'
      ELSE NULL
    END as level_name,
    CASE ga.achievement_type
      WHEN 'streak' THEN (ga.metadata->>'streak_count')::int
      ELSE NULL
    END as streak_count
  FROM goal_achievements ga
  LEFT JOIN goals g ON g.id = ga.goal_id
  LEFT JOIN profiles p ON p.id = ga.professional_id AND p.tenant_id = ga.tenant_id
  WHERE ga.tenant_id = p_tenant_id
    AND (p_professional_id IS NULL OR ga.professional_id = p_professional_id)
  ORDER BY ga.achieved_at DESC;
END;
$$;


-- ============================================
-- Function: redeem_voucher_v1
-- Source: 20260219200000_phase3_vendas_fidelidade.sql
-- ============================================
CREATE OR REPLACE FUNCTION redeem_voucher_v1(
  p_code     text,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_voucher   vouchers%ROWTYPE;
  v_order     orders%ROWTYPE;
BEGIN
  -- Resolve caller tenant
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE id = auth.uid();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','unauthenticated');
  END IF;

  -- Fetch order
  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','order_not_found');
  END IF;
  IF v_order.status NOT IN ('draft','open') THEN
    RETURN jsonb_build_object('success',false,'error','order_not_editable');
  END IF;
  IF v_order.applied_voucher_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',false,'error','voucher_already_applied');
  END IF;

  -- Fetch voucher
  SELECT * INTO v_voucher FROM vouchers
  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','voucher_not_found');
  END IF;
  IF v_voucher.status <> 'ativo' THEN
    RETURN jsonb_build_object('success',false,'error','voucher_inactive');
  END IF;
  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE vouchers SET status='expirado' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success',false,'error','voucher_expired');
  END IF;

  -- Apply: set discount and mark voucher
  UPDATE orders
  SET discount_amount    = LEAST(subtotal_amount, discount_amount + v_voucher.valor),
      total_amount       = GREATEST(0, total_amount - v_voucher.valor),
      applied_voucher_id = v_voucher.id
  WHERE id = p_order_id;

  -- Mark voucher redeemed
  UPDATE vouchers SET status='resgatado' WHERE id = v_voucher.id;

  -- Ledger entry
  INSERT INTO voucher_redemptions(voucher_id, tenant_id, order_id, redeemed_by)
  VALUES (v_voucher.id, v_tenant_id, p_order_id, auth.uid());

  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher.id,
    'discount_applied', v_voucher.valor
  );
END;
$$;


-- ============================================
-- Function: validate_coupon_v1
-- Source: 20260219200000_phase3_vendas_fidelidade.sql
-- ============================================
CREATE OR REPLACE FUNCTION validate_coupon_v1(
  p_code      text,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon discount_coupons%ROWTYPE;
BEGIN
  SELECT * INTO v_coupon FROM discount_coupons
  WHERE code = UPPER(TRIM(p_code)) AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid',false,'error','not_found');
  END IF;
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid',false,'error','inactive');
  END IF;
  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > CURRENT_DATE THEN
    RETURN jsonb_build_object('valid',false,'error','not_yet_valid');
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < CURRENT_DATE THEN
    RETURN jsonb_build_object('valid',false,'error','expired');
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid',false,'error','max_uses_reached');
  END IF;

  RETURN jsonb_build_object(
    'valid',        true,
    'coupon_id',    v_coupon.id,
    'type',         v_coupon.type,
    'value',        v_coupon.value,
    'service_id',   v_coupon.service_id
  );
END;
$$;


-- ============================================
-- Function: seed_default_loyalty_tiers_v1
-- Source: 20260219200000_phase3_vendas_fidelidade.sql
-- ============================================
CREATE OR REPLACE FUNCTION seed_default_loyalty_tiers_v1(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO loyalty_tiers(tenant_id, name, min_points, discount_percent, color, icon, sort_order)
  VALUES
    (p_tenant_id, 'Bronze', 0,    0,    '#cd7f32', '🥉', 0),
    (p_tenant_id, 'Prata',  500,  5,    '#9ca3af', '🥈', 1),
    (p_tenant_id, 'Ouro',   2000, 10,   '#d97706', '🥇', 2)
  ON CONFLICT DO NOTHING;
END;
$$;


-- ============================================
-- Function: create_goal_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_goal_v2(
  p_name text,
  p_goal_type text,
  p_target_value numeric,
  p_period text,
  p_professional_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_show_in_header boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');
  END IF;

  IF p_target_value IS NULL OR p_target_value <= 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inválida');
  END IF;

  INSERT INTO public.goals(
    tenant_id,
    name,
    goal_type,
    target_value,
    period,
    professional_id,
    product_id,
    show_in_header
  ) VALUES (
    v_profile.tenant_id,
    COALESCE(NULLIF(btrim(p_name),''), 'Meta'),
    p_goal_type,
    p_target_value,
    p_period,
    p_professional_id,
    p_product_id,
    COALESCE(p_show_in_header,false)
  ) RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'goal_created',
    'goal',
    v_id::text,
    jsonb_build_object('goal_type', p_goal_type, 'target_value', p_target_value, 'period', p_period)
  );

  RETURN jsonb_build_object('success', true, 'goal_id', v_id);
END;
$$;


-- ============================================
-- Function: update_goal_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_goal_v2(
  p_goal_id uuid,
  p_name text,
  p_target_value numeric,
  p_period text,
  p_professional_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_show_in_header boolean DEFAULT NULL,
  p_header_priority integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');
  END IF;

  IF p_target_value IS NULL OR p_target_value <= 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inválida');
  END IF;

  UPDATE public.goals
  SET name = p_name,
      target_value = p_target_value,
      period = p_period,
      professional_id = p_professional_id,
      product_id = p_product_id,
      show_in_header = COALESCE(p_show_in_header, show_in_header),
      header_priority = COALESCE(p_header_priority, header_priority),
      updated_at = now()
  WHERE id = p_goal_id
    AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Meta não encontrada');
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'goal_updated',
    'goal',
    p_goal_id::text,
    jsonb_build_object('target_value', p_target_value, 'period', p_period)
  );

  RETURN jsonb_build_object('success', true, 'goal_id', p_goal_id);
END;
$$;


-- ============================================
-- Function: archive_goal_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.archive_goal_v2(
  p_goal_id uuid,
  p_archived boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_archived_at timestamptz;
  v_priority integer;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode gerenciar metas');
  END IF;

  IF p_archived THEN
    v_archived_at := now();
    v_priority := 0;
  ELSE
    v_archived_at := NULL;
    v_priority := NULL;
  END IF;

  UPDATE public.goals
  SET archived_at = v_archived_at,
      updated_at = now(),
      show_in_header = CASE WHEN p_archived THEN false ELSE show_in_header END,
      header_priority = CASE WHEN p_archived THEN 0 ELSE header_priority END
  WHERE id = p_goal_id
    AND tenant_id = v_profile.tenant_id;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Meta não encontrada');
  END IF;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    CASE WHEN p_archived THEN 'goal_archived' ELSE 'goal_unarchived' END,
    'goal',
    p_goal_id::text,
    jsonb_build_object('archived', p_archived)
  );

  RETURN jsonb_build_object('success', true, 'goal_id', p_goal_id, 'archived', p_archived);
END;
$$;


-- ============================================
-- Function: create_goal_template_v2
-- Source: 20260310142000_misc_write_rpcs.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_goal_template_v2(
  p_name text,
  p_goal_type text,
  p_target_value numeric,
  p_period text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND THEN
    PERFORM public.raise_app_error('PROFILE_NOT_FOUND', 'Perfil não encontrado');
  END IF;

  IF NOT public.is_tenant_admin(v_user_id, v_profile.tenant_id) THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas admin pode salvar template');
  END IF;

  IF p_target_value IS NULL OR p_target_value <= 0 THEN
    PERFORM public.raise_app_error('VALIDATION_ERROR', 'Meta inválida');
  END IF;

  INSERT INTO public.goal_templates(tenant_id, name, goal_type, target_value, period)
  VALUES (v_profile.tenant_id, p_name, p_goal_type, p_target_value, p_period)
  RETURNING id INTO v_id;

  PERFORM public.log_tenant_action(
    v_profile.tenant_id,
    v_user_id,
    'goal_template_created',
    'goal_template',
    v_id::text,
    jsonb_build_object('goal_type', p_goal_type, 'target_value', p_target_value, 'period', p_period)
  );

  RETURN jsonb_build_object('success', true, 'template_id', v_id);
END;
$$;


-- ============================================
-- Function: create_client_package_v1
-- Source: 20260312010000_crm_packages_v1.sql
-- ============================================
create or replace function public.create_client_package_v1(
  p_client_id uuid,
  p_service_id uuid,
  p_total_sessions integer,
  p_expires_at timestamptz default null,
  p_notes text default null
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
  v_pkg_id uuid;
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
    perform public.raise_app_error('FORBIDDEN', 'Apenas administradores podem criar pacotes');
  end if;

  if p_total_sessions is null or p_total_sessions <= 0 then
    perform public.raise_app_error('VALIDATION_ERROR', 'Quantidade de sessões inválida');
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.tenant_id = v_profile.tenant_id) then
    perform public.raise_app_error('NOT_FOUND', 'Cliente não encontrado');
  end if;

  if not exists (select 1 from public.services s where s.id = p_service_id and s.tenant_id = v_profile.tenant_id and s.is_active = true) then
    perform public.raise_app_error('NOT_FOUND', 'Serviço não encontrado');
  end if;

  insert into public.client_packages(
    tenant_id, client_id, service_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, notes, created_by
  ) values (
    v_profile.tenant_id, p_client_id, p_service_id, p_total_sessions, p_total_sessions, 'active', now(), p_expires_at, nullif(btrim(p_notes), ''), v_user_id
  ) returning id into v_pkg_id;

  insert into public.client_package_ledger(
    tenant_id, package_id, appointment_id, delta_sessions, reason, notes, actor_user_id
  ) values (
    v_profile.tenant_id, v_pkg_id, null, p_total_sessions, 'purchase', 'Compra de pacote', v_user_id
  );

  return jsonb_build_object('success', true, 'package_id', v_pkg_id);
end;
$$;


-- ============================================
-- Function: sign_consent_v2
-- Source: 20260724000002_security_consent_hash.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.sign_consent_v2(
  p_consent_id            uuid DEFAULT NULL,
  p_client_id             uuid DEFAULT NULL,
  p_template_id           uuid DEFAULT NULL,
  p_signature_method      text DEFAULT NULL,
  p_facial_photo_path     text DEFAULT NULL,
  p_manual_signature_path text DEFAULT NULL,
  p_ip_address            text DEFAULT NULL,
  p_user_agent            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_consent_id     UUID;
  v_template       public.consent_templates%ROWTYPE;
  v_tenant_id      UUID;
  v_actual_client  UUID;
  v_doc_hash       TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  IF p_signature_method NOT IN ('facial', 'manual') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'signature_method deve ser facial ou manual');
  END IF;

  IF p_signature_method = 'facial' AND (p_facial_photo_path IS NULL OR p_facial_photo_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'facial_photo_path é obrigatório para assinatura facial');
  END IF;

  IF p_signature_method = 'manual' AND (p_manual_signature_path IS NULL OR p_manual_signature_path = '') THEN
    PERFORM public.raise_app_error('INVALID_INPUT', 'manual_signature_path é obrigatório para assinatura manual');
  END IF;

  -- Modo 1: Atualizar consent existente
  IF p_consent_id IS NOT NULL THEN
    SELECT pc.id, pc.tenant_id, pc.patient_id, pc.template_id
    INTO v_consent_id, v_tenant_id, v_actual_client, p_template_id
    FROM public.patient_consents pc
    WHERE pc.id = p_consent_id
      AND pc.patient_user_id = v_user_id
    LIMIT 1;

    IF v_consent_id IS NULL THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Consentimento não encontrado ou não pertence a você');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.patient_consents
      WHERE id = p_consent_id AND signature_method IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente', 'consent_id', p_consent_id);
    END IF;

    SELECT ct.* INTO v_template
    FROM public.consent_templates ct
    WHERE ct.id = p_template_id AND ct.is_active = true;

    -- Compute hash
    v_doc_hash := encode(digest(COALESCE(v_template.body_html, '')::bytea, 'sha256'), 'hex');

    UPDATE public.patient_consents SET
      signed_at              = now(),
      signature_method       = p_signature_method,
      facial_photo_path      = CASE WHEN p_signature_method = 'facial' THEN p_facial_photo_path ELSE facial_photo_path END,
      manual_signature_path  = CASE WHEN p_signature_method = 'manual' THEN p_manual_signature_path ELSE manual_signature_path END,
      ip_address             = p_ip_address,
      user_agent             = p_user_agent,
      template_snapshot_html = COALESCE(template_snapshot_html, v_template.body_html),
      document_hash          = v_doc_hash
    WHERE id = p_consent_id;

  ELSIF p_client_id IS NOT NULL AND p_template_id IS NOT NULL THEN
    SELECT ct.* INTO v_template
    FROM public.consent_templates ct
    JOIN public.clients c ON c.tenant_id = ct.tenant_id
    WHERE ct.id = p_template_id
      AND c.id = p_client_id
      AND ct.is_active = true;

    IF NOT FOUND THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.patient_id = p_client_id AND pc.template_id = p_template_id
        AND pc.signature_method IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente');
    END IF;

    -- Compute hash
    v_doc_hash := encode(digest(v_template.body_html::bytea, 'sha256'), 'hex');

    INSERT INTO public.patient_consents (
      tenant_id, patient_id, template_id, patient_user_id,
      signed_at, signature_method,
      facial_photo_path, manual_signature_path,
      ip_address, user_agent,
      template_snapshot_html, document_hash
    )
    VALUES (
      v_template.tenant_id, p_client_id, p_template_id, v_user_id,
      now(), p_signature_method,
      CASE WHEN p_signature_method = 'facial' THEN p_facial_photo_path ELSE NULL END,
      CASE WHEN p_signature_method = 'manual' THEN p_manual_signature_path ELSE NULL END,
      p_ip_address, p_user_agent,
      v_template.body_html, v_doc_hash
    )
    ON CONFLICT (patient_id, template_id) DO UPDATE SET
      signed_at              = now(),
      signature_method       = EXCLUDED.signature_method,
      facial_photo_path      = EXCLUDED.facial_photo_path,
      manual_signature_path  = EXCLUDED.manual_signature_path,
      ip_address             = EXCLUDED.ip_address,
      user_agent             = EXCLUDED.user_agent,
      template_snapshot_html = EXCLUDED.template_snapshot_html,
      document_hash          = EXCLUDED.document_hash
    RETURNING id INTO v_consent_id;

  ELSE
    PERFORM public.raise_app_error('INVALID_INPUT', 'Informe consent_id ou client_id + template_id');
  END IF;

  v_consent_id := COALESCE(v_consent_id, p_consent_id);

  RETURN jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'template_title', v_template.title
  );
END;
$$;


-- ============================================
-- Function: seal_consent_pdf
-- Source: 20260316200000_consent_sealed_architecture.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.seal_consent_pdf(
  p_consent_id      UUID,
  p_sealed_pdf_path TEXT,
  p_sealed_pdf_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_consents SET
    sealed_pdf_path = p_sealed_pdf_path,
    sealed_pdf_hash = p_sealed_pdf_hash,
    sealed_at       = now()
  WHERE id = p_consent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent % not found', p_consent_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success',    true,
    'consent_id', p_consent_id,
    'sealed_at',  now()
  );
END;
$$;


-- ============================================
-- Function: trg_auto_generate_consents_on_plan_approval
-- Source: 20260722000000_fix_consent_rpcs_client_id_to_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_auto_generate_consents_on_plan_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_patient_user_id UUID;
BEGIN
  -- Só dispara quando status muda para 'aprovado'
  IF NEW.status <> 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;

  -- Buscar o user_id do paciente via patient_profiles
  SELECT pp.user_id INTO v_patient_user_id
  FROM public.patient_profiles pp
  WHERE pp.client_id = NEW.patient_id
    AND pp.tenant_id = NEW.tenant_id
    AND pp.is_active = true
  LIMIT 1;

  -- Se paciente não tem conta no portal, não gera consents automáticos
  IF v_patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Para cada consent_template ativo e obrigatório do tenant
  FOR v_template IN
    SELECT ct.id, ct.title, ct.body_html, ct.tenant_id
    FROM public.consent_templates ct
    WHERE ct.tenant_id = NEW.tenant_id
      AND ct.is_active = true
      AND ct.is_required = true
      AND NOT EXISTS (
        SELECT 1 FROM public.patient_consents pc
        WHERE pc.patient_id = NEW.patient_id
          AND pc.template_id = ct.id
      )
  LOOP
    INSERT INTO public.patient_consents (
      tenant_id,
      patient_id,
      template_id,
      patient_user_id,
      template_snapshot_html,
      signed_at
    )
    VALUES (
      v_template.tenant_id,
      NEW.patient_id,
      v_template.id,
      v_patient_user_id,
      v_template.body_html,
      NOW()
    )
    ON CONFLICT (patient_id, template_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_pending_consents
-- Source: 20260722000000_fix_consent_rpcs_client_id_to_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_pending_consents(p_client_id uuid)
RETURNS SETOF consent_templates
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ct.*
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
  WHERE c.id = p_client_id
    AND ct.is_active = true
    AND ct.is_required = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.patient_id = p_client_id
        AND pc.template_id = ct.id
    )
  ORDER BY ct.sort_order, ct.created_at;
$$;


-- ============================================
-- Function: sign_consent
-- Source: 20260724000002_security_consent_hash.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.sign_consent(
  p_client_id        uuid,
  p_template_id      uuid,
  p_facial_photo_path text,
  p_ip_address       text,
  p_user_agent       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_template public.consent_templates%rowtype;
  v_consent_id uuid;
  v_doc_hash text;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT ct.* INTO v_template
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
  WHERE ct.id = p_template_id
    AND c.id = p_client_id
    AND ct.is_active = true;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.patient_consents pc
    WHERE pc.patient_id = p_client_id AND pc.template_id = p_template_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente');
  END IF;

  -- Compute SHA-256 hash of the document content
  v_doc_hash := encode(digest(v_template.body_html::bytea, 'sha256'), 'hex');

  INSERT INTO public.patient_consents (
    tenant_id, patient_id, template_id, patient_user_id,
    facial_photo_path, ip_address, user_agent,
    template_snapshot_html, document_hash, signed_at
  )
  VALUES (
    v_template.tenant_id, p_client_id, p_template_id, v_user_id,
    p_facial_photo_path, p_ip_address, p_user_agent,
    v_template.body_html, v_doc_hash, now()
  )
  RETURNING id INTO v_consent_id;

  RETURN jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'template_title', v_template.title
  );
END;
$$;


-- ============================================
-- Function: upsert_consent_template
-- Source: 20260328200000_consent_pdf_upload_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_consent_template(
  p_title TEXT,
  p_slug TEXT,
  p_body_html TEXT,
  p_is_required BOOLEAN,
  p_is_active BOOLEAN,
  p_sort_order INT,
  p_template_id UUID DEFAULT NULL,
  p_template_type TEXT DEFAULT 'html',
  p_pdf_storage_path TEXT DEFAULT NULL,
  p_pdf_original_filename TEXT DEFAULT NULL,
  p_pdf_file_size INTEGER DEFAULT NULL
)
RETURNS public.consent_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_template public.consent_templates%rowtype;
BEGIN
  -- Obter tenant do usuário
  SELECT get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  END IF;

  -- Verificar se é admin
  IF NOT is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar termos';
  END IF;

  -- Validar tipo
  IF p_template_type NOT IN ('html', 'pdf') THEN
    RAISE EXCEPTION 'Tipo de template inválido: %', p_template_type;
  END IF;

  -- Se for PDF, precisa ter o path
  IF p_template_type = 'pdf' AND p_pdf_storage_path IS NULL THEN
    RAISE EXCEPTION 'PDF storage path é obrigatório para templates do tipo PDF';
  END IF;

  IF p_template_id IS NOT NULL THEN
    -- Update existente
    UPDATE public.consent_templates
    SET 
      title = p_title,
      slug = p_slug,
      body_html = p_body_html,
      is_required = p_is_required,
      is_active = p_is_active,
      sort_order = p_sort_order,
      template_type = p_template_type,
      pdf_storage_path = p_pdf_storage_path,
      pdf_original_filename = p_pdf_original_filename,
      pdf_file_size = p_pdf_file_size,
      updated_at = now()
    WHERE id = p_template_id AND tenant_id = v_tenant_id
    RETURNING * INTO v_template;
    
    IF v_template.id IS NULL THEN
      RAISE EXCEPTION 'Template não encontrado ou sem permissão';
    END IF;
  ELSE
    -- Insert novo
    INSERT INTO public.consent_templates (
      tenant_id, title, slug, body_html, is_required, is_active, sort_order,
      template_type, pdf_storage_path, pdf_original_filename, pdf_file_size
    )
    VALUES (
      v_tenant_id, p_title, p_slug, p_body_html, p_is_required, p_is_active, p_sort_order,
      p_template_type, p_pdf_storage_path, p_pdf_original_filename, p_pdf_file_size
    )
    RETURNING * INTO v_template;
  END IF;

  RETURN v_template;
END;
$$;


-- ============================================
-- Function: award_health_credits
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.award_health_credits(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_type text DEFAULT 'manual',
  p_reference_id uuid DEFAULT NULL,
  p_expiry_days integer DEFAULT 365,
  p_created_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance integer;
  v_new_lifetime integer;
  v_new_tier text;
  v_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Quantidade de créditos deve ser positiva';
  END IF;

  -- Upsert no saldo
  INSERT INTO public.health_credits_balance (tenant_id, patient_id, balance, lifetime_earned, tier)
  VALUES (p_tenant_id, p_patient_id, p_amount, p_amount, public.hc_recalc_tier(p_amount))
  ON CONFLICT (tenant_id, patient_id)
  DO UPDATE SET
    balance = health_credits_balance.balance + p_amount,
    lifetime_earned = health_credits_balance.lifetime_earned + p_amount,
    tier = public.hc_recalc_tier(health_credits_balance.lifetime_earned + p_amount),
    updated_at = now()
  RETURNING balance, lifetime_earned, tier
  INTO v_new_balance, v_new_lifetime, v_new_tier;

  -- Registrar transação
  INSERT INTO public.health_credits_transactions (
    tenant_id, patient_id, type, amount, balance_after,
    reason, reference_type, reference_id, created_by, expires_at
  ) VALUES (
    p_tenant_id, p_patient_id, 'earn', p_amount, v_new_balance,
    p_reason, p_reference_type, p_reference_id,
    COALESCE(p_created_by, auth.uid()),
    CASE WHEN p_expiry_days > 0 THEN now() + (p_expiry_days || ' days')::interval ELSE NULL END
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'lifetime_earned', v_new_lifetime,
    'tier', v_new_tier,
    'awarded', p_amount
  );
END;
$$;


-- ============================================
-- Function: redeem_health_credits
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.redeem_health_credits(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'Resgate de créditos',
  p_reference_type text DEFAULT 'manual',
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Quantidade de créditos deve ser positiva';
  END IF;

  -- Lock e verificar saldo
  SELECT balance INTO v_current_balance
  FROM public.health_credits_balance
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Paciente não possui saldo de créditos';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, solicitado: %', v_current_balance, p_amount;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.health_credits_balance
  SET balance = v_new_balance,
      lifetime_redeemed = lifetime_redeemed + p_amount,
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id;

  INSERT INTO public.health_credits_transactions (
    tenant_id, patient_id, type, amount, balance_after,
    reason, reference_type, reference_id, created_by
  ) VALUES (
    p_tenant_id, p_patient_id, 'redeem', -p_amount, v_new_balance,
    p_reason, p_reference_type, p_reference_id, auth.uid()
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'redeemed', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;


-- ============================================
-- Function: adjust_health_credits
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.adjust_health_credits(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_amount integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance integer;
  v_tx_id uuid;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Ajuste não pode ser zero';
  END IF;

  -- Verificar se é admin do tenant
  IF NOT public.is_tenant_admin(auth.uid(), p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem fazer ajustes manuais';
  END IF;

  -- Upsert no saldo
  INSERT INTO public.health_credits_balance (tenant_id, patient_id, balance, tier)
  VALUES (p_tenant_id, p_patient_id, GREATEST(p_amount, 0), 'bronze')
  ON CONFLICT (tenant_id, patient_id)
  DO UPDATE SET
    balance = GREATEST(health_credits_balance.balance + p_amount, 0),
    lifetime_earned = CASE
      WHEN p_amount > 0 THEN health_credits_balance.lifetime_earned + p_amount
      ELSE health_credits_balance.lifetime_earned
    END,
    tier = CASE
      WHEN p_amount > 0 THEN public.hc_recalc_tier(health_credits_balance.lifetime_earned + p_amount)
      ELSE health_credits_balance.tier
    END,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.health_credits_transactions (
    tenant_id, patient_id, type, amount, balance_after,
    reason, reference_type, created_by
  ) VALUES (
    p_tenant_id, p_patient_id, 'adjustment', p_amount, v_new_balance,
    p_reason, 'manual', auth.uid()
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'adjusted', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;


-- ============================================
-- Function: get_health_credits_leaderboard
-- Source: 20260325100000_health_credits_engine.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_health_credits_leaderboard(
  p_tenant_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  patient_id uuid,
  patient_name text,
  balance integer,
  lifetime_earned integer,
  lifetime_redeemed integer,
  tier text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    b.patient_id,
    COALESCE(c.name, 'Paciente') AS patient_name,
    b.balance,
    b.lifetime_earned,
    b.lifetime_redeemed,
    b.tier,
    b.updated_at
  FROM public.health_credits_balance b
  JOIN public.patients c ON c.id = b.patient_id
  WHERE b.tenant_id = p_tenant_id
    AND b.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ORDER BY b.lifetime_earned DESC
  LIMIT p_limit;
$$;


-- ============================================
-- Function: create_consent_signing_link
-- Source: 20260722000000_fix_consent_rpcs_client_id_to_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_consent_signing_link(
  p_client_id      uuid,
  p_template_ids   uuid[] DEFAULT NULL,
  p_expires_hours  int DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
  v_token TEXT;
  v_template_ids UUID[];
  v_client_name TEXT;
  v_token_id UUID;
BEGIN
  -- Obter tenant do usuário
  SELECT get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  END IF;

  -- Verificar se cliente pertence ao tenant
  SELECT name INTO v_client_name
  FROM public.clients
  WHERE id = p_client_id AND tenant_id = v_tenant_id;

  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  -- Se não especificou templates, pegar todos os ativos obrigatórios
  IF p_template_ids IS NULL OR array_length(p_template_ids, 1) IS NULL THEN
    SELECT array_agg(id) INTO v_template_ids
    FROM public.consent_templates
    WHERE tenant_id = v_tenant_id
      AND is_active = true
      AND is_required = true;
  ELSE
    v_template_ids := p_template_ids;
  END IF;

  -- Verificar se há templates
  IF v_template_ids IS NULL OR array_length(v_template_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum termo disponível para assinatura';
  END IF;

  -- Gerar token
  v_token := generate_consent_signing_token();

  -- Criar registro
  INSERT INTO public.consent_signing_tokens (
    tenant_id,
    patient_id,
    token,
    template_ids,
    expires_at,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_client_id,
    v_token,
    v_template_ids,
    now() + (p_expires_hours || ' hours')::interval,
    auth.uid()
  )
  RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'token_id', v_token_id,
    'client_name', v_client_name,
    'template_count', array_length(v_template_ids, 1),
    'expires_at', now() + (p_expires_hours || ' hours')::interval
  );
END;
$$;


-- ============================================
-- Function: is_gamification_enabled_for_user
-- Source: 20260325200000_gamification_settings_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION is_gamification_enabled_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_enabled boolean;
  v_user_enabled boolean;
BEGIN
  SELECT 
    t.gamification_enabled,
    p.show_gamification_popups
  INTO v_tenant_enabled, v_user_enabled
  FROM profiles p
  JOIN tenants t ON t.id = p.tenant_id
  WHERE p.user_id = p_user_id;
  
  -- Ambos precisam estar true para mostrar pop-ups
  RETURN COALESCE(v_tenant_enabled, true) AND COALESCE(v_user_enabled, true);
END;
$$;


-- ============================================
-- Function: get_referral_report
-- Source: 20260328300000_fix_referral_report_types_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_referral_report(
    p_tenant_id UUID,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL,
    p_referrer_id UUID DEFAULT NULL
)
RETURNS TABLE (
    referrer_id UUID,
    referrer_name TEXT,
    referrer_role TEXT,
    month TIMESTAMPTZ,
    total_appointments BIGINT,
    unique_patients BIGINT,
    completed_appointments BIGINT,
    total_revenue DECIMAL,
    total_commission DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.referrer_id,
        v.referrer_name::text,
        v.referrer_role::text,
        v.month,
        v.total_appointments,
        v.unique_patients,
        v.completed_appointments,
        v.total_revenue,
        v.total_commission
    FROM public.v_referral_report v
    WHERE v.tenant_id = p_tenant_id
    AND (p_from_date IS NULL OR v.month >= p_from_date::timestamptz)
    AND (p_to_date IS NULL OR v.month <= (p_to_date + INTERVAL '1 day')::timestamptz)
    AND (p_referrer_id IS NULL OR v.referrer_id = p_referrer_id)
    ORDER BY v.month DESC, v.total_revenue DESC;
END;
$$;


-- ============================================
-- Function: check_and_notify_tier_change
-- Source: 20260327500000_tier_change_notification_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.check_and_notify_tier_change(
    p_tenant_id UUID,
    p_professional_id UUID
)
RETURNS TABLE (
    tier_changed BOOLEAN,
    old_tier_value DECIMAL,
    new_tier_value DECIMAL,
    monthly_revenue DECIMAL,
    notification_sent BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule RECORD;
    v_monthly_revenue DECIMAL(12,2);
    v_current_tier_index INTEGER := 0;
    v_current_tier_value DECIMAL(5,2) := 0;
    v_old_tier_index INTEGER;
    v_old_tier_value DECIMAL(5,2);
    v_tier RECORD;
    v_tier_idx INTEGER := 0;
    v_tracking RECORD;
    v_notification_title TEXT;
    v_notification_body TEXT;
BEGIN
    -- Buscar regra escalonada ativa do profissional
    SELECT cr.* INTO v_rule
    FROM public.commission_rules cr
    WHERE cr.tenant_id = p_tenant_id
    AND cr.professional_id = p_professional_id
    AND cr.calculation_type = 'tiered'
    AND cr.is_active = TRUE
    ORDER BY cr.priority DESC
    LIMIT 1;

    -- Se não tem regra escalonada, retornar sem mudança
    IF v_rule.id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, FALSE;
        RETURN;
    END IF;

    -- Calcular faturamento do mês atual
    SELECT COALESCE(SUM(a.price), 0) INTO v_monthly_revenue
    FROM public.appointments a
    WHERE a.tenant_id = p_tenant_id
    AND a.professional_id = p_professional_id
    AND a.status = 'completed'
    AND a.scheduled_at >= DATE_TRUNC('month', NOW())
    AND a.scheduled_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';

    -- Encontrar faixa atual baseada no faturamento
    FOR v_tier IN 
        SELECT 
            (tier->>'min')::DECIMAL AS tier_min,
            (tier->>'max')::DECIMAL AS tier_max,
            (tier->>'value')::DECIMAL AS tier_value
        FROM jsonb_array_elements(v_rule.tier_config) AS tier
        ORDER BY (tier->>'min')::DECIMAL ASC
    LOOP
        IF v_monthly_revenue >= v_tier.tier_min 
           AND (v_tier.tier_max IS NULL OR v_monthly_revenue <= v_tier.tier_max) THEN
            v_current_tier_index := v_tier_idx;
            v_current_tier_value := v_tier.tier_value;
        END IF;
        v_tier_idx := v_tier_idx + 1;
    END LOOP;

    -- Buscar tracking existente
    SELECT * INTO v_tracking
    FROM public.professional_tier_tracking
    WHERE tenant_id = p_tenant_id
    AND professional_id = p_professional_id
    AND rule_id = v_rule.id;

    -- Se não existe tracking, criar
    IF v_tracking.id IS NULL THEN
        INSERT INTO public.professional_tier_tracking (
            tenant_id, professional_id, rule_id, 
            current_tier_index, current_tier_value, monthly_revenue
        ) VALUES (
            p_tenant_id, p_professional_id, v_rule.id,
            v_current_tier_index, v_current_tier_value, v_monthly_revenue
        );
        
        RETURN QUERY SELECT FALSE, v_current_tier_value, v_current_tier_value, v_monthly_revenue, FALSE;
        RETURN;
    END IF;

    v_old_tier_index := v_tracking.current_tier_index;
    v_old_tier_value := v_tracking.current_tier_value;

    -- Verificar se houve mudança de faixa
    IF v_current_tier_index != v_old_tier_index THEN
        -- Atualizar tracking
        UPDATE public.professional_tier_tracking
        SET current_tier_index = v_current_tier_index,
            current_tier_value = v_current_tier_value,
            monthly_revenue = v_monthly_revenue,
            last_checked_at = NOW(),
            updated_at = NOW()
        WHERE id = v_tracking.id;

        -- Criar notificação
        IF v_current_tier_value > v_old_tier_value THEN
            v_notification_title := 'Parabéns! Sua comissão aumentou! 🎉';
            v_notification_body := format(
                'Você atingiu a faixa de %s%% de comissão! Continue assim!',
                v_current_tier_value
            );
        ELSE
            v_notification_title := 'Sua faixa de comissão mudou';
            v_notification_body := format(
                'Sua comissão atual é de %s%%. Aumente seu faturamento para subir de faixa!',
                v_current_tier_value
            );
        END IF;

        -- Inserir notificação
        INSERT INTO public.notifications (
            tenant_id,
            user_id,
            type,
            title,
            body,
            data
        ) VALUES (
            p_tenant_id,
            p_professional_id,
            'tier_change',
            v_notification_title,
            v_notification_body,
            jsonb_build_object(
                'old_tier', v_old_tier_value,
                'new_tier', v_current_tier_value,
                'monthly_revenue', v_monthly_revenue,
                'rule_id', v_rule.id
            )
        );

        RETURN QUERY SELECT TRUE, v_old_tier_value, v_current_tier_value, v_monthly_revenue, TRUE;
        RETURN;
    ELSE
        -- Apenas atualizar o faturamento
        UPDATE public.professional_tier_tracking
        SET monthly_revenue = v_monthly_revenue,
            last_checked_at = NOW(),
            updated_at = NOW()
        WHERE id = v_tracking.id;

        RETURN QUERY SELECT FALSE, v_current_tier_value, v_current_tier_value, v_monthly_revenue, FALSE;
        RETURN;
    END IF;
END;
$$;


-- ============================================
-- Function: generate_consent_signing_token
-- Source: 20260328400000_consent_signing_tokens_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_consent_signing_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Gera token de 32 caracteres alfanuméricos
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');
    v_token := substring(v_token from 1 for 32);
    
    SELECT EXISTS(SELECT 1 FROM public.consent_signing_tokens WHERE token = v_token) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_token;
END;
$$;


-- ============================================
-- Function: validate_consent_token
-- Source: 20260328400000_consent_signing_tokens_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_consent_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_client RECORD;
  v_tenant RECORD;
  v_templates JSONB;
  v_pending_templates JSONB;
BEGIN
  -- Buscar token
  SELECT * INTO v_token_record
  FROM public.consent_signing_tokens
  WHERE token = p_token;
  
  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token inválido ou não encontrado');
  END IF;
  
  -- Verificar expiração
  IF v_token_record.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Link expirado. Solicite um novo link à clínica.');
  END IF;
  
  -- Verificar se já foi usado
  IF v_token_record.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este link já foi utilizado.');
  END IF;
  
  -- Buscar dados do cliente
  SELECT id, name, email, phone, cpf, date_of_birth, birth_date,
         street, street_number, neighborhood, city, state, zip_code,
         address_street, address_city, address_state, address_zip
  INTO v_client
  FROM public.clients
  WHERE id = v_token_record.client_id;
  
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Paciente não encontrado');
  END IF;
  
  -- Buscar dados do tenant
  SELECT name, cnpj, address, responsible_doctor, responsible_crm
  INTO v_tenant
  FROM public.tenants
  WHERE id = v_token_record.tenant_id;
  
  -- Buscar templates que ainda não foram assinados
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ct.id,
      'title', ct.title,
      'slug', ct.slug,
      'body_html', ct.body_html,
      'is_required', ct.is_required,
      'template_type', ct.template_type,
      'pdf_storage_path', ct.pdf_storage_path
    )
  ) INTO v_pending_templates
  FROM public.consent_templates ct
  WHERE ct.id = ANY(v_token_record.template_ids)
    AND ct.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.client_id = v_token_record.client_id
        AND pc.template_id = ct.id
    );
  
  -- Se todos já foram assinados
  IF v_pending_templates IS NULL OR jsonb_array_length(v_pending_templates) = 0 THEN
    -- Marcar token como usado
    UPDATE public.consent_signing_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;
    
    RETURN jsonb_build_object(
      'valid', true,
      'all_signed', true,
      'client_name', v_client.name,
      'clinic_name', v_tenant.name
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'all_signed', false,
    'token_id', v_token_record.id,
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'email', v_client.email,
      'phone', v_client.phone,
      'cpf', v_client.cpf,
      'date_of_birth', COALESCE(v_client.date_of_birth, v_client.birth_date),
      'address', COALESCE(
        v_client.street || COALESCE(', ' || v_client.street_number, '') || 
        COALESCE(' - ' || v_client.neighborhood, '') || 
        COALESCE(' - ' || v_client.city, '') || 
        COALESCE('/' || v_client.state, ''),
        v_client.address_street || COALESCE(' - ' || v_client.address_city, '') || 
        COALESCE('/' || v_client.address_state, '')
      )
    ),
    'tenant', jsonb_build_object(
      'name', v_tenant.name,
      'cnpj', v_tenant.cnpj,
      'address', v_tenant.address,
      'responsible_doctor', v_tenant.responsible_doctor,
      'responsible_crm', v_tenant.responsible_crm
    ),
    'templates', v_pending_templates
  );
END;
$$;


-- ============================================
-- Function: sign_consent_via_token
-- Source: 20260722000000_fix_consent_rpcs_client_id_to_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.sign_consent_via_token(
  p_token            text,
  p_template_id      uuid,
  p_facial_photo_path text,
  p_ip_address       text,
  p_user_agent       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_record RECORD;
  v_template RECORD;
  v_consent_id UUID;
  v_remaining INT;
BEGIN
  -- Buscar e validar token
  SELECT * INTO v_token_record
  FROM public.consent_signing_tokens
  WHERE token = p_token
    AND expires_at > now()
    AND used_at IS NULL;

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido, expirado ou já utilizado');
  END IF;

  -- Verificar se template está na lista permitida
  IF NOT (p_template_id = ANY(v_token_record.template_ids)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Termo não autorizado para este link');
  END IF;

  -- Buscar template
  SELECT * INTO v_template
  FROM public.consent_templates
  WHERE id = p_template_id
    AND tenant_id = v_token_record.tenant_id
    AND is_active = true;

  IF v_template IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Termo não encontrado ou inativo');
  END IF;

  -- Verificar se já foi assinado
  IF EXISTS (
    SELECT 1 FROM public.patient_consents
    WHERE patient_id = v_token_record.patient_id
      AND template_id = p_template_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este termo já foi assinado');
  END IF;

  -- Criar assinatura
  INSERT INTO public.patient_consents (
    tenant_id,
    patient_id,
    template_id,
    signed_at,
    ip_address,
    user_agent,
    facial_photo_path,
    template_snapshot_html
  )
  VALUES (
    v_token_record.tenant_id,
    v_token_record.patient_id,
    p_template_id,
    now(),
    p_ip_address,
    p_user_agent,
    p_facial_photo_path,
    v_template.body_html
  )
  RETURNING id INTO v_consent_id;

  -- Contar quantos termos ainda faltam
  SELECT COUNT(*) INTO v_remaining
  FROM public.consent_templates ct
  WHERE ct.id = ANY(v_token_record.template_ids)
    AND ct.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.patient_id = v_token_record.patient_id
        AND pc.template_id = ct.id
    );

  -- Se todos foram assinados, marcar token como usado
  IF v_remaining = 0 THEN
    UPDATE public.consent_signing_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'remaining', v_remaining,
    'all_done', v_remaining = 0
  );
END;
$$;


-- ============================================
-- Function: trigger_notify_consent_signed
-- Source: 20260703200000_fix_all_client_id_triggers_v2.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_notify_consent_signed()
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
    'consent_signed',
    'queued',
    jsonb_build_object(
      'consent_id', NEW.id,
      'template_id', NEW.template_id
    )
  );
  RETURN NEW;
END;
$$;

