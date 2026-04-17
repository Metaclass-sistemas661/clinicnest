CREATE OR REPLACE FUNCTION public.get_dashboard_salary_totals(p_tenant_id uuid, p_is_admin boolean, p_professional_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_pending NUMERIC := 0;

  v_paid NUMERIC := 0;

  v_month_start TIMESTAMPTZ;

  v_month_end TIMESTAMPTZ;

  v_current_month INTEGER;

  v_current_year INTEGER;

BEGIN

  v_month_start := date_trunc('month', now());

  v_month_end := date_trunc('month', now()) + interval '1 month' - interval '1 second';

  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;

  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;



  -- Seguran├ºa: chamador deve pertencer ao tenant

  IF current_setting('app.current_user_id')::uuid IS NOT NULL AND NOT EXISTS (

    SELECT 1 FROM public.profiles p 

    WHERE p.tenant_id = p_tenant_id AND p.user_id = current_setting('app.current_user_id')::uuid

  ) THEN

    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);

  END IF;



  -- Staff s├│ pode ver pr├│prios sal├írios

  IF NOT p_is_admin AND p_professional_user_id IS NOT NULL AND p_professional_user_id != current_setting('app.current_user_id')::uuid THEN

    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);

  END IF;



  IF p_is_admin THEN

    -- Admin: calcular sal├írios a pagar (profissionais com sal├írio configurado que ainda n├úo foram pagos no m├¬s)

    -- Primeiro, buscar profissionais com sal├írio configurado

    SELECT COALESCE(SUM(pc.salary_amount), 0)

    INTO v_pending

    FROM professional_commissions pc

    WHERE pc.tenant_id = p_tenant_id

      AND pc.payment_type = 'salary'

      AND pc.salary_amount IS NOT NULL

      AND pc.salary_amount > 0

      AND NOT EXISTS (

        SELECT 1 FROM salary_payments sp

        WHERE sp.tenant_id = p_tenant_id

          AND sp.professional_id = pc.user_id

          AND sp.payment_year = v_current_year

          AND sp.payment_month = v_current_month

          AND sp.status = 'paid'

      );



    -- Admin: calcular sal├írios pagos no m├¬s

    SELECT COALESCE(SUM(sp.amount), 0)

    INTO v_paid

    FROM salary_payments sp

    WHERE sp.tenant_id = p_tenant_id

      AND sp.payment_year = v_current_year

      AND sp.payment_month = v_current_month

      AND sp.status = 'paid';

  ELSE

    -- Staff: apenas seus pr├│prios sal├írios

    IF p_professional_user_id IS NOT NULL THEN

      -- Staff: verificar se tem sal├írio configurado e n├úo foi pago

      SELECT COALESCE(SUM(pc.salary_amount), 0)

      INTO v_pending

      FROM professional_commissions pc

      WHERE pc.tenant_id = p_tenant_id

        AND pc.user_id = p_professional_user_id

        AND pc.payment_type = 'salary'

        AND pc.salary_amount IS NOT NULL

        AND pc.salary_amount > 0

        AND NOT EXISTS (

          SELECT 1 FROM salary_payments sp

          WHERE sp.tenant_id = p_tenant_id

            AND sp.professional_id = p_professional_user_id

            AND sp.payment_year = v_current_year

            AND sp.payment_month = v_current_month

            AND sp.status = 'paid'

        );



      -- Staff: calcular sal├írios pagos no m├¬s

      SELECT COALESCE(SUM(sp.amount), 0)

      INTO v_paid

      FROM salary_payments sp

      WHERE sp.tenant_id = p_tenant_id

        AND sp.professional_id = p_professional_user_id

        AND sp.payment_year = v_current_year

        AND sp.payment_month = v_current_month

        AND sp.status = 'paid';

    END IF;

  END IF;



  RETURN jsonb_build_object(

    'pending', (v_pending)::float,

    'paid', (v_paid)::float

  );

END;

$function$;