CREATE OR REPLACE FUNCTION public.get_my_context()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
        SELECT json_build_object(
          'profile', (SELECT row_to_json(p.*) FROM profiles p WHERE p.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid),
          'role', (SELECT row_to_json(ur.*) FROM user_roles ur WHERE ur.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid LIMIT 1),
          'tenant', (SELECT row_to_json(t.*) FROM tenants t WHERE t.id = (SELECT tenant_id FROM profiles WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)),
          'permissions', json_build_object()
        );
      $function$;