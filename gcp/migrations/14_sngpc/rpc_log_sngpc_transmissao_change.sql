CREATE OR REPLACE FUNCTION public.log_sngpc_transmissao_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  IF OLD.status IS DISTINCT FROM NEW.status THEN

    INSERT INTO sngpc_transmissoes_log (

      transmissao_id,

      acao,

      status_anterior,

      status_novo,

      executado_por

    ) VALUES (

      NEW.id,

      'mudanca_status',

      OLD.status,

      NEW.status,

      current_setting('app.current_user_id')::uuid

    );

  END IF;

  RETURN NEW;

END;

$function$;