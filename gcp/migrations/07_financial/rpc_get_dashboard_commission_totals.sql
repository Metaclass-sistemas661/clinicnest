CREATE OR REPLACE FUNCTION public.get_dashboard_commission_totals(p_tenant_id uuid, p_is_admin boolean, p_professional_user_id uuid DEFAULT NULL::uuid)
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

BEGIN

  v_month_start := date_trunc('month', now());

  v_month_end := date_trunc('month', now()) + interval '1 month' - interval '1 second';



  -- Seguran├ºa: chamador deve pertencer ao tenant

  IF current_setting('app.current_user_id')::uuid IS NOT NULL AND NOT EXISTS (

    SELECT 1 FROM public.profiles p 

    WHERE p.tenant_id = p_tenant_id AND p.user_id = current_setting('app.current_user_id')::uuid

  ) THEN

    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);

  END IF;



  -- Staff s├│ pode ver pr├│prias comiss├Áes

  IF NOT p_is_admin AND p_professional_user_id IS NOT NULL AND p_professional_user_id != current_setting('app.current_user_id')::uuid THEN

    RETURN jsonb_build_object('pending', 0::float, 'paid', 0::float);

  END IF;



  IF p_is_admin THEN

    -- Admin: soma de todas as comiss├Áes do tenant

    -- FILTRAR: apenas comiss├Áes de profissionais com payment_type = 'commission' ou NULL

    SELECT 

      COALESCE(SUM(CASE WHEN cp.status::text = 'pending' THEN cp.amount ELSE 0 END), 0),

      COALESCE(SUM(CASE WHEN cp.status::text = 'paid' THEN cp.amount ELSE 0 END), 0)

    INTO v_pending, v_paid

    FROM commission_payments cp

    LEFT JOIN professional_commissions pc ON pc.id = cp.commission_config_id

    WHERE cp.tenant_id = p_tenant_id

      AND cp.created_at >= v_month_start

      AND cp.created_at <= v_month_end

      AND (pc.payment_type IS NULL OR pc.payment_type = 'commission');  -- Excluir sal├írios

  ELSE

    -- Staff: apenas suas comiss├Áes

    IF p_professional_user_id IS NOT NULL THEN

      SELECT 

        COALESCE(SUM(CASE WHEN cp.status::text = 'pending' THEN cp.amount ELSE 0 END), 0),

        COALESCE(SUM(CASE WHEN cp.status::text = 'paid' THEN cp.amount ELSE 0 END), 0)

      INTO v_pending, v_paid

      FROM commission_payments cp

      LEFT JOIN professional_commissions pc ON pc.id = cp.commission_config_id

      WHERE cp.tenant_id = p_tenant_id

        AND cp.professional_id = p_professional_user_id

        AND cp.created_at >= v_month_start

        AND cp.created_at <= v_month_end

        AND (pc.payment_type IS NULL OR pc.payment_type = 'commission');  -- Excluir sal├írios

    END IF;

  END IF;



  RETURN jsonb_build_object(

    'pending', (v_pending)::float,

    'paid', (v_paid)::float

  );

END;

$function$;