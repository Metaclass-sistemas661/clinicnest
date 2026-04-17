CREATE OR REPLACE FUNCTION public.create_feature_override(p_tenant_id uuid, p_feature_key text, p_is_enabled boolean DEFAULT true, p_reason text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
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

  INSERT INTO tenant_feature_overrides (

    tenant_id, feature_key, is_enabled, reason, enabled_by, expires_at

  ) VALUES (

    p_tenant_id, p_feature_key, p_is_enabled, p_reason, v_actor_id, p_expires_at

  )

  ON CONFLICT (tenant_id, feature_key) DO UPDATE SET

    is_enabled = EXCLUDED.is_enabled,

    reason = EXCLUDED.reason,

    enabled_by = EXCLUDED.enabled_by,

    expires_at = EXCLUDED.expires_at,

    updated_at = now()

  RETURNING id INTO v_override_id;



  -- Registrar auditoria

  INSERT INTO override_audit_log (

    tenant_id, override_type, override_id, action, new_value, changed_by

  ) VALUES (

    p_tenant_id, 'feature', v_override_id, 'created',

    json_build_object(

      'feature_key', p_feature_key,

      'is_enabled', p_is_enabled,

      'reason', p_reason,

      'expires_at', p_expires_at

    ),

    v_actor_id

  );



  RETURN v_override_id;

END;

$function$;