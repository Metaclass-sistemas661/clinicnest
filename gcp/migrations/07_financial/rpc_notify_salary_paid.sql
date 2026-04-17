CREATE OR REPLACE FUNCTION public.notify_salary_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_wants_notification BOOLEAN;

  v_month_name TEXT;

  v_payment_method_label TEXT;

BEGIN

  -- S├│ notificar quando status muda para 'paid'

  IF OLD.status = 'paid' OR NEW.status != 'paid' THEN

    RETURN NEW;

  END IF;



  -- Verificar se profissional quer receber notifica├º├úo

  SELECT COALESCE(salary_paid, true) INTO v_wants_notification

  FROM public.user_notification_preferences

  WHERE user_id = NEW.professional_id;



  IF v_wants_notification IS FALSE THEN

    RETURN NEW;

  END IF;



  -- Nome do m├¬s

  v_month_name := to_char(make_date(NEW.payment_year, NEW.payment_month, 1), 'TMMonth');



  -- Label do m├®todo de pagamento

  v_payment_method_label := CASE NEW.payment_method

    WHEN 'pix' THEN 'via PIX'

    WHEN 'deposit' THEN 'via dep├│sito'

    WHEN 'transfer' THEN 'via transfer├¬ncia'

    WHEN 'cash' THEN 'em esp├®cie'

    ELSE ''

  END;



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

    'salary_paid',

    'Sal├írio pago',

    format(

      'Seu sal├írio de %s (R$ %s) foi pago%s',

      v_month_name,

      to_char(NEW.amount, 'FM999G999D00'),

      CASE WHEN v_payment_method_label != '' THEN ' ' || v_payment_method_label ELSE '' END

    ),

    jsonb_build_object(

      'salary_id', NEW.id,

      'amount', NEW.amount,

      'payment_month', NEW.payment_month,

      'payment_year', NEW.payment_year,

      'payment_method', NEW.payment_method,

      'payment_date', NEW.payment_date

    )

  );



  RETURN NEW;

END;

$function$;