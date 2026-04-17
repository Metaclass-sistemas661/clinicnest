CREATE OR REPLACE FUNCTION public.notify_commission_generated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_professional_name TEXT;

  v_service_name TEXT;

  v_client_name TEXT;

  v_percentage NUMERIC;

  v_wants_notification BOOLEAN;

BEGIN

  -- Verificar se profissional quer receber notifica├º├úo

  SELECT COALESCE(commission_generated, true) INTO v_wants_notification

  FROM public.user_notification_preferences

  WHERE user_id = NEW.professional_id;



  IF v_wants_notification IS FALSE THEN

    RETURN NEW;

  END IF;



  -- Buscar dados para a notifica├º├úo

  SELECT full_name INTO v_professional_name

  FROM public.profiles

  WHERE user_id = NEW.professional_id;



  -- Buscar nome do servi├ºo e cliente via appointment

  IF NEW.appointment_id IS NOT NULL THEN

    SELECT 

      s.name,

      c.name

    INTO v_service_name, v_client_name

    FROM public.appointments a

    LEFT JOIN public.services s ON s.id = a.service_id

    LEFT JOIN public.clients c ON c.id = a.client_id

    WHERE a.id = NEW.appointment_id;

  END IF;



  -- Calcular percentual

  IF NEW.service_price > 0 THEN

    v_percentage := ROUND((NEW.amount / NEW.service_price) * 100, 0);

  ELSE

    v_percentage := 0;

  END IF;



  -- Criar notifica├º├úo

  INSERT INTO public.notifications (

    tenant_id,

    user_id,

    type,

    title,

    body,

    metadata

  ) VALUES (

    NEW.tenant_id,

    NEW.professional_id,

    'commission_generated',

    'Comiss├úo gerada',

    format(

      'Comiss├úo de R$ %s gerada (%s%% de R$ %s)%s',

      to_char(NEW.amount, 'FM999G999D00'),

      v_percentage::TEXT,

      to_char(NEW.service_price, 'FM999G999D00'),

      CASE WHEN v_service_name IS NOT NULL THEN ' - ' || v_service_name ELSE '' END

    ),

    jsonb_build_object(

      'commission_id', NEW.id,

      'amount', NEW.amount,

      'service_price', NEW.service_price,

      'percentage', v_percentage,

      'service_name', v_service_name,

      'client_name', v_client_name,

      'appointment_id', NEW.appointment_id

    )

  );



  RETURN NEW;

END;

$function$;