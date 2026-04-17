CREATE OR REPLACE FUNCTION public.is_gamification_enabled_for_user(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_enabled boolean;

  v_user_enabled boolean;

BEGIN

  SELECT 

    t.gamification_enabled,

    p.show_gamification_popups

  INTO v_tenant_enabled, v_user_enabled

  FROM profiles p

  JOIN tenants t ON t.id = p.tenant_id

  WHERE p.user_id = p_user_id;

  

  -- Ambos precisam estar true para mostrar pop-ups

  RETURN COALESCE(v_tenant_enabled, true) AND COALESCE(v_user_enabled, true);

END;

$function$;