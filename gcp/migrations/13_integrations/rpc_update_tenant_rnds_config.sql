CREATE OR REPLACE FUNCTION public.update_tenant_rnds_config(p_rnds_enabled boolean DEFAULT NULL::boolean, p_rnds_cnes character varying DEFAULT NULL::character varying, p_rnds_uf character varying DEFAULT NULL::character varying, p_rnds_environment character varying DEFAULT NULL::character varying, p_rnds_auto_send boolean DEFAULT NULL::boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

BEGIN

  v_tenant_id := get_user_tenant_id(current_setting('app.current_user_id')::uuid);

  

  UPDATE tenants SET

    rnds_enabled = COALESCE(p_rnds_enabled, rnds_enabled),

    rnds_cnes = COALESCE(p_rnds_cnes, rnds_cnes),

    rnds_uf = COALESCE(p_rnds_uf, rnds_uf),

    rnds_environment = COALESCE(p_rnds_environment, rnds_environment),

    rnds_auto_send = COALESCE(p_rnds_auto_send, rnds_auto_send),

    updated_at = NOW()

  WHERE id = v_tenant_id;

  

  RETURN TRUE;

END;

$function$;