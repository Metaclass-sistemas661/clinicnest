CREATE OR REPLACE FUNCTION public.calcular_prazo_lgpd()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  -- Prazo de 15 dias para resposta (Art. 18 ┬º 3┬║)

  NEW.prazo_resposta := NEW.data_solicitacao + INTERVAL '15 days';

  RETURN NEW;

END;

$function$;