CREATE OR REPLACE FUNCTION public.get_goal_progress_history(p_goal_id uuid, p_tenant_id uuid)
 RETURNS TABLE(day_date date, cumulative_value numeric, progress_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

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



  -- Per├¡odo

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

$function$;