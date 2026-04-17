CREATE OR REPLACE FUNCTION public.get_tenant_overrides()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id UUID;

  v_result JSON;

BEGIN

  -- Obter tenant_id do usu├írio autenticado

  SELECT tenant_id INTO v_tenant_id

  FROM profiles

  WHERE user_id = current_setting('app.current_user_id')::uuid

  LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RETURN json_build_object('features', '[]'::json, 'limits', '[]'::json);

  END IF;



  SELECT json_build_object(

    'features', COALESCE((

      SELECT json_agg(json_build_object(

        'id', id,

        'feature_key', feature_key,

        'is_enabled', is_enabled,

        'reason', reason,

        'expires_at', expires_at

      ))

      FROM tenant_feature_overrides

      WHERE tenant_id = v_tenant_id

        AND (expires_at IS NULL OR expires_at > now())

    ), '[]'::json),

    'limits', COALESCE((

      SELECT json_agg(json_build_object(

        'id', id,

        'limit_key', limit_key,

        'custom_value', custom_value,

        'reason', reason,

        'expires_at', expires_at

      ))

      FROM tenant_limit_overrides

      WHERE tenant_id = v_tenant_id

        AND (expires_at IS NULL OR expires_at > now())

    ), '[]'::json)

  ) INTO v_result;



  RETURN v_result;

END;

$function$;