CREATE OR REPLACE FUNCTION public.get_dashboard_product_loss_total(p_tenant_id uuid, p_year integer DEFAULT NULL::integer, p_month integer DEFAULT NULL::integer)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_total_loss NUMERIC := 0;

  v_month_start TIMESTAMPTZ;

  v_month_end TIMESTAMPTZ;

  v_current_month INTEGER;

  v_current_year INTEGER;

BEGIN

  -- Se n├úo especificado, usar m├¬s atual

  IF p_year IS NULL OR p_month IS NULL THEN

    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;

    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

    v_month_start := date_trunc('month', CURRENT_DATE);

    v_month_end := date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 second';

  ELSE

    v_current_month := p_month;

    v_current_year := p_year;

    v_month_start := date_trunc('month', make_date(p_year, p_month, 1));

    v_month_end := date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month' - interval '1 second';

  END IF;



  -- Seguran├ºa: chamador deve pertencer ao tenant

  IF current_setting('app.current_user_id')::uuid IS NOT NULL AND NOT EXISTS (

    SELECT 1 FROM public.profiles p 

    WHERE p.tenant_id = p_tenant_id AND p.user_id = current_setting('app.current_user_id')::uuid

  ) THEN

    RETURN 0;

  END IF;



  -- Calcular total de perdas: SUM(ABS(quantity) * cost) para movimentos danificados do m├¬s

  SELECT COALESCE(SUM(ABS(sm.quantity) * COALESCE(p.cost, 0)), 0)

  INTO v_total_loss

  FROM stock_movements sm

  LEFT JOIN products p ON p.id = sm.product_id

  WHERE sm.tenant_id = p_tenant_id

    AND sm.movement_type = 'out'

    AND sm.out_reason_type = 'damaged'

    AND sm.created_at >= v_month_start

    AND sm.created_at <= v_month_end;



  RETURN v_total_loss;

END;

$function$;