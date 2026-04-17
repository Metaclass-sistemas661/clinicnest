CREATE OR REPLACE FUNCTION public.calcular_prazo_notificacao_anpd()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  -- Prazo de 72 horas para notifica├º├úo (Art. 48 ┬º 1┬║)

  IF NEW.requer_notificacao_anpd = true THEN

    NEW.prazo_notificacao := NEW.data_deteccao + INTERVAL '72 hours';

  END IF;

  RETURN NEW;

END;

$function$;