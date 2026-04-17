CREATE OR REPLACE FUNCTION public.create_financial_transaction_v2(p_type transaction_type, p_category text, p_amount numeric, p_description text DEFAULT NULL::text, p_transaction_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_profile public.profiles%rowtype;

  v_amount numeric;

  v_id uuid;

  v_date date;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  SELECT * INTO v_profile

  FROM public.profiles p

  WHERE p.user_id = v_user_id

  LIMIT 1;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado';

  END IF;



  IF p_type IS NULL THEN

    RAISE EXCEPTION 'type ├® obrigat├│rio';

  END IF;



  IF p_category IS NULL OR btrim(p_category) = '' THEN

    RAISE EXCEPTION 'category ├® obrigat├│rio';

  END IF;



  v_amount := COALESCE(p_amount, 0);

  IF v_amount <= 0 THEN

    RAISE EXCEPTION 'amount deve ser maior que zero';

  END IF;



  v_date := COALESCE(p_transaction_date, CURRENT_DATE);



  INSERT INTO public.financial_transactions (

    tenant_id,

    type,

    category,

    amount,

    description,

    transaction_date

  ) VALUES (

    v_profile.tenant_id,

    p_type,

    p_category,

    v_amount,

    NULLIF(p_description, ''),

    v_date

  )

  RETURNING id INTO v_id;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id,

    v_user_id,

    'financial_transaction_created',

    'financial_transaction',

    v_id::text,

    jsonb_build_object(

      'type', p_type,

      'category', p_category,

      'amount', v_amount,

      'transaction_date', v_date

    )

  );



  RETURN jsonb_build_object('success', true, 'transaction_id', v_id);

END;

$function$;