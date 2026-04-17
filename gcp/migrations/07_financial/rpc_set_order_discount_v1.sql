CREATE OR REPLACE FUNCTION public.set_order_discount_v1(p_order_id uuid, p_discount_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id  uuid := current_setting('app.current_user_id')::uuid;

  v_profile  public.profiles%rowtype;

  v_order    public.orders%rowtype;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND'; END IF;



  SELECT * INTO v_order FROM public.orders

  WHERE id = p_order_id AND tenant_id = v_profile.tenant_id

  FOR UPDATE;



  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda n├úo encontrada' USING DETAIL = 'NOT_FOUND'; END IF;



  IF v_order.status NOT IN ('draft', 'open') THEN

    RAISE EXCEPTION 'Comanda n├úo permite altera├º├Áes' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_discount_amount < 0 THEN

    RAISE EXCEPTION 'Desconto n├úo pode ser negativo' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF p_discount_amount > v_order.subtotal_amount THEN

    RAISE EXCEPTION 'Desconto n├úo pode ser maior que o subtotal' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  UPDATE public.orders

  SET discount_amount = p_discount_amount,

      total_amount = GREATEST(subtotal_amount - p_discount_amount, 0),

      updated_at = now()

  WHERE id = p_order_id;



  RETURN jsonb_build_object(

    'success', true,

    'total_amount', GREATEST(v_order.subtotal_amount - p_discount_amount, 0)

  );

END;

$function$;