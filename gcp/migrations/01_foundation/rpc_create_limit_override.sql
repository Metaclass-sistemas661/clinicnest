CREATE OR REPLACE FUNCTION public.create_limit_override(p_tenant_id uuid, p_limit_key text, p_custom_value integer, p_reason text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_actor_id UUID;

  v_override_id UUID;

BEGIN

  -- Verificar se o usu├írio ├® super-admin (implementar l├│gica espec├¡fica)

  SELECT id INTO v_actor_id

  FROM profiles

  WHERE user_id = current_setting('app.current_user_id')::uuid

  LIMIT 1;



  -- Inserir ou atualizar override

  INSERT INTO tenant_limit_overrides (

    tenant_id, limit_key, custom_value, reason, enabled_by, expires_at

  ) VALUES (

    p_tenant_id, p_limit_key, p_custom_value, p_reason, v_actor_id, p_expires_at

  )

  ON CONFLICT (tenant_id, limit_key) DO UPDATE SET

    custom_value = EXCLUDED.custom_value,

    reason = EXCLUDED.reason,

    enabled_by = EXCLUDED.enabled_by,

    expires_at = EXCLUDED.expires_at,

    updated_at = now()

  RETURNING id INTO v_override_id;



  -- Registrar auditoria

  INSERT INTO override_audit_log (

    tenant_id, override_type, override_id, action, new_value, changed_by

  ) VALUES (

    p_tenant_id, 'limit', v_override_id, 'created',

    json_build_object(

      'limit_key', p_limit_key,

      'custom_value', p_custom_value,

      'reason', p_reason,

      'expires_at', p_expires_at

    ),

    v_actor_id

  );



  RETURN v_override_id;

END;

$function$;