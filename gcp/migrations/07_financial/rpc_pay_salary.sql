CREATE OR REPLACE FUNCTION public.pay_salary(p_professional_id uuid, p_payment_month integer, p_payment_year integer, p_payment_method text, p_days_worked integer DEFAULT NULL::integer, p_payment_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester_user_id UUID := current_setting('app.current_user_id')::uuid;

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

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  SELECT p.tenant_id

  INTO v_requester_tenant_id

  FROM public.profiles p

  WHERE p.user_id = v_requester_user_id

  LIMIT 1;



  IF v_requester_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Perfil do usu├írio n├úo encontrado';

  END IF;



  v_requester_is_admin := public.is_tenant_admin(v_requester_user_id, v_requester_tenant_id);

  IF NOT v_requester_is_admin THEN

    RAISE EXCEPTION 'Apenas administradores podem registrar pagamento de sal├írio';

  END IF;



  IF p_payment_month < 1 OR p_payment_month > 12 THEN

    RAISE EXCEPTION 'M├¬s de pagamento inv├ílido';

  END IF;



  IF p_payment_year < 2020 THEN

    RAISE EXCEPTION 'Ano de pagamento inv├ílido';

  END IF;



  IF p_days_worked IS NOT NULL AND p_days_worked < 0 THEN

    RAISE EXCEPTION 'Dias trabalhados n├úo pode ser negativo';

  END IF;



  IF p_payment_method NOT IN ('pix', 'deposit', 'cash', 'other') THEN

    RAISE EXCEPTION 'M├®todo de pagamento inv├ílido';

  END IF;



  SELECT p.tenant_id, p.full_name

  INTO v_tenant_id, v_professional_name

  FROM public.profiles p

  WHERE p.user_id = p_professional_id

  LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Profissional n├úo encontrado';

  END IF;



  IF v_tenant_id <> v_requester_tenant_id THEN

    RAISE EXCEPTION 'Sem permiss├úo para registrar sal├írio fora do seu tenant';

  END IF;



  SELECT *

  INTO v_commission_config

  FROM public.professional_commissions

  WHERE user_id = p_professional_id

    AND tenant_id = v_tenant_id

    AND payment_type = 'salary'

  LIMIT 1;



  IF v_commission_config IS NULL THEN

    RAISE EXCEPTION 'Profissional n├úo possui sal├írio fixo configurado';

  END IF;



  IF v_commission_config.salary_amount IS NULL OR v_commission_config.salary_amount <= 0 THEN

    RAISE EXCEPTION 'Valor do sal├írio n├úo configurado ou inv├ílido';

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

      RAISE EXCEPTION 'Dias trabalhados n├úo pode ser maior que os dias do m├¬s (%)', v_days_in_month;

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

    RAISE EXCEPTION 'Sal├írio j├í foi pago para este per├¡odo';

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

    'Funcion├írios',

    v_calculated_amount,

    'Sal├írio - ' || COALESCE(v_professional_name, 'Profissional') ||

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

$function$;