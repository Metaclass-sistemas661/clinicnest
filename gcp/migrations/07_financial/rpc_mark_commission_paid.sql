CREATE OR REPLACE FUNCTION public.mark_commission_paid(p_commission_payment_id uuid, p_payment_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_row public.commission_payments%rowtype;

  v_paid boolean;

  v_payment_date date;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  v_payment_date := COALESCE(p_payment_date, current_date);



  PERFORM pg_advisory_xact_lock(hashtext(p_commission_payment_id::text), hashtext('mark_commission_paid'));



  SELECT * INTO v_row

  FROM public.commission_payments cp

  WHERE cp.id = p_commission_payment_id

  FOR UPDATE;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Comiss├úo n├úo encontrada';

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_row.tenant_id) THEN

    RAISE EXCEPTION 'Apenas admin pode pagar comiss├úo';

  END IF;



  v_paid := (v_row.status = 'paid');

  IF v_paid THEN

    PERFORM public.log_tenant_action(

      v_row.tenant_id,

      v_user_id,

      'commission_marked_paid',

      'commission_payment',

      v_row.id::text,

      jsonb_build_object('already_paid', true)

    );



    RETURN jsonb_build_object('success', true, 'already_paid', true, 'commission_payment_id', v_row.id);

  END IF;



  IF v_row.status = 'cancelled' THEN

    RAISE EXCEPTION 'Comiss├úo cancelada n├úo pode ser paga';

  END IF;



  UPDATE public.commission_payments

    SET status = 'paid',

        payment_date = v_payment_date,

        paid_by = v_user_id,

        updated_at = now()

  WHERE id = v_row.id;



  PERFORM public.log_tenant_action(

    v_row.tenant_id,

    v_user_id,

    'commission_marked_paid',

    'commission_payment',

    v_row.id::text,

    jsonb_build_object('already_paid', false, 'payment_date', v_payment_date)

  );



  RETURN jsonb_build_object('success', true, 'already_paid', false, 'commission_payment_id', v_row.id);

END;

$function$;