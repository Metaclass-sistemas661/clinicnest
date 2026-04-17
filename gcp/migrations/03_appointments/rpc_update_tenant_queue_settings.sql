CREATE OR REPLACE FUNCTION public.update_tenant_queue_settings(p_tenant_id uuid, p_auto_queue_on_checkin boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

  IF NOT is_tenant_admin(current_setting('app.current_user_id')::uuid, p_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem alterar configura├º├Áes';

  END IF;

  UPDATE tenants SET auto_queue_on_checkin = p_auto_queue_on_checkin WHERE id = p_tenant_id;

END;

$function$;