CREATE OR REPLACE FUNCTION public.create_order_for_appointment_v1(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id   uuid := current_setting('app.current_user_id')::uuid;

  v_profile   public.profiles%rowtype;

  v_apt       public.appointments%rowtype;

  v_order_id  uuid;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;



  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Perfil n├úo encontrado' USING DETAIL = 'PROFILE_NOT_FOUND';

  END IF;



  SELECT * INTO v_apt

  FROM public.appointments

  WHERE id = p_appointment_id AND tenant_id = v_profile.tenant_id;



  IF NOT FOUND THEN

    RAISE EXCEPTION 'Agendamento n├úo encontrado' USING DETAIL = 'NOT_FOUND';

  END IF;



  IF v_apt.status = 'cancelled' THEN

    RAISE EXCEPTION 'Agendamento cancelado n├úo pode ter comanda' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  IF v_apt.status = 'completed' THEN

    RAISE EXCEPTION 'Agendamento j├í conclu├¡do' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  -- Uniqueness enforced by DB constraint, but give a friendly message

  IF EXISTS (

    SELECT 1 FROM public.orders WHERE tenant_id = v_profile.tenant_id AND appointment_id = p_appointment_id

  ) THEN

    RAISE EXCEPTION 'Este agendamento j├í possui uma comanda' USING DETAIL = 'VALIDATION_ERROR';

  END IF;



  INSERT INTO public.orders (

    tenant_id, appointment_id, client_id, professional_id,

    status, created_by

  ) VALUES (

    v_profile.tenant_id, v_apt.id, v_apt.client_id, v_apt.professional_id,

    'open', v_user_id

  )

  RETURNING id INTO v_order_id;



  -- If appointment has a service, auto-add as first item

  IF v_apt.service_id IS NOT NULL THEN

    INSERT INTO public.order_items (

      tenant_id, order_id, kind, service_id, professional_id,

      quantity, unit_price, total_price

    ) VALUES (

      v_profile.tenant_id, v_order_id, 'service', v_apt.service_id, v_apt.professional_id,

      1, v_apt.price, v_apt.price

    );



    UPDATE public.orders

    SET subtotal_amount = v_apt.price,

        total_amount = v_apt.price,

        updated_at = now()

    WHERE id = v_order_id;

  END IF;



  PERFORM public.log_tenant_action(

    v_profile.tenant_id, v_user_id,

    'order_created_from_appointment', 'order', v_order_id::text,

    jsonb_build_object('appointment_id', p_appointment_id)

  );



  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);

END;

$function$;