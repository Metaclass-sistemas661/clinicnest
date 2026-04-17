CREATE OR REPLACE FUNCTION public.get_professionals_with_salary(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;

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

$function$;