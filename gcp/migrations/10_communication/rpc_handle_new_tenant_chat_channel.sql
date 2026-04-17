CREATE OR REPLACE FUNCTION public.handle_new_tenant_chat_channel()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

BEGIN

  INSERT INTO public.chat_channels (tenant_id, name, description, is_default)

  VALUES (NEW.id, 'Geral', 'Canal geral da equipe', true);

  RETURN NEW;

END;

$function$;