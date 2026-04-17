CREATE OR REPLACE FUNCTION public.get_all_overrides(p_tenant_id uuid DEFAULT NULL::uuid, p_include_expired boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_result JSON;

BEGIN

  SELECT json_build_object(

    'features', COALESCE((

      SELECT json_agg(json_build_object(

        'id', fo.id,

        'tenant_id', fo.tenant_id,

        'tenant_name', t.name,

        'feature_key', fo.feature_key,

        'is_enabled', fo.is_enabled,

        'reason', fo.reason,

        'enabled_by', fo.enabled_by,

        'enabled_by_name', p.full_name,

        'expires_at', fo.expires_at,

        'created_at', fo.created_at,

        'is_expired', fo.expires_at IS NOT NULL AND fo.expires_at <= now()

      ) ORDER BY fo.created_at DESC)

      FROM tenant_feature_overrides fo

      LEFT JOIN tenants t ON t.id = fo.tenant_id

      LEFT JOIN profiles p ON p.id = fo.enabled_by

      WHERE (p_tenant_id IS NULL OR fo.tenant_id = p_tenant_id)

        AND (p_include_expired OR fo.expires_at IS NULL OR fo.expires_at > now())

    ), '[]'::json),

    'limits', COALESCE((

      SELECT json_agg(json_build_object(

        'id', lo.id,

        'tenant_id', lo.tenant_id,

        'tenant_name', t.name,

        'limit_key', lo.limit_key,

        'custom_value', lo.custom_value,

        'reason', lo.reason,

        'enabled_by', lo.enabled_by,

        'enabled_by_name', p.full_name,

        'expires_at', lo.expires_at,

        'created_at', lo.created_at,

        'is_expired', lo.expires_at IS NOT NULL AND lo.expires_at <= now()

      ) ORDER BY lo.created_at DESC)

      FROM tenant_limit_overrides lo

      LEFT JOIN tenants t ON t.id = lo.tenant_id

      LEFT JOIN profiles p ON p.id = lo.enabled_by

      WHERE (p_tenant_id IS NULL OR lo.tenant_id = p_tenant_id)

        AND (p_include_expired OR lo.expires_at IS NULL OR lo.expires_at > now())

    ), '[]'::json)

  ) INTO v_result;



  RETURN v_result;

END;

$function$;