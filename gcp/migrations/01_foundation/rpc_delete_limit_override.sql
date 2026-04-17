CREATE OR REPLACE FUNCTION public.delete_limit_override(p_tenant_id uuid, p_limit_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_actor_id UUID;

  v_override_id UUID;

  v_old_value JSONB;

BEGIN

  SELECT id INTO v_actor_id

  FROM profiles

  WHERE user_id = current_setting('app.current_user_id')::uuid

  LIMIT 1;



  -- Buscar override existente

  SELECT id, json_build_object(

    'limit_key', limit_key,

    'custom_value', custom_value,

    'reason', reason,

    'expires_at', expires_at

  )::jsonb

  INTO v_override_id, v_old_value

  FROM tenant_limit_overrides

  WHERE tenant_id = p_tenant_id AND limit_key = p_limit_key;



  IF v_override_id IS NULL THEN

    RETURN false;

  END IF;



  -- Deletar override

  DELETE FROM tenant_limit_overrides

  WHERE id = v_override_id;



  -- Registrar auditoria

  INSERT INTO override_audit_log (

    tenant_id, override_type, override_id, action, old_value, changed_by

  ) VALUES (

    p_tenant_id, 'limit', v_override_id, 'deleted', v_old_value, v_actor_id

  );



  RETURN true;

END;

$function$;