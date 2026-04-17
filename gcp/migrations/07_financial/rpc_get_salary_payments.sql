CREATE OR REPLACE FUNCTION public.get_salary_payments(p_tenant_id uuid, p_professional_id uuid DEFAULT NULL::uuid, p_year integer DEFAULT NULL::integer, p_month integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;

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

$function$;