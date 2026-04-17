CREATE OR REPLACE FUNCTION public.notify_commission_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_wants_notification BOOLEAN;

  v_total_paid NUMERIC;

BEGIN

  -- S├│ notificar quando status muda para 'paid'

  IF OLD.status = 'paid' OR NEW.status != 'paid' THEN

    RETURN NEW;

  END IF;



  -- Verificar se profissional quer receber notifica├º├úo

  SELECT COALESCE(commission_paid, true) INTO v_wants_notification

  FROM public.user_notification_preferences

  WHERE user_id = NEW.professional_id;



  IF v_wants_notification IS FALSE THEN

    RETURN NEW;

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

    'commission_paid',

    'Comiss├úo paga',

    format('Sua comiss├úo de R$ %s foi paga!', to_char(NEW.amount, 'FM999G999D00')),

    jsonb_build_object(

      'commission_id', NEW.id,

      'amount', NEW.amount,

      'payment_date', NEW.payment_date

    )

  );



  RETURN NEW;

END;

$function$;