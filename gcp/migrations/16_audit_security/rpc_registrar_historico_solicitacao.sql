CREATE OR REPLACE FUNCTION public.registrar_historico_solicitacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  IF OLD.status IS DISTINCT FROM NEW.status THEN

    NEW.historico := NEW.historico || jsonb_build_object(

      'timestamp', NOW(),

      'status_anterior', OLD.status,

      'status_novo', NEW.status,

      'usuario', current_setting('app.current_user_id')::uuid

    );

  END IF;

  NEW.updated_at := NOW();

  RETURN NEW;

END;

$function$;