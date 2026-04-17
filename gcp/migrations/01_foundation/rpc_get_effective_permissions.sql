CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id UUID;

  v_prof_type public.professional_type;

  v_is_admin BOOLEAN;

  v_is_readonly BOOLEAN;

  v_base JSONB;

  v_resource TEXT;

  v_override JSONB;

  v_perm JSONB;

BEGIN

  SELECT p.tenant_id, p.professional_type, p.is_readonly

  INTO v_tenant_id, v_prof_type, v_is_readonly

  FROM public.profiles p

  WHERE p.user_id = p_user_id

  LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RETURN '{}'::jsonb;

  END IF;



  v_is_admin := EXISTS (

    SELECT 1 FROM public.user_roles ur

    WHERE ur.user_id = p_user_id AND ur.tenant_id = v_tenant_id AND ur.role = 'admin'

  );



  IF v_is_admin THEN

    SELECT permissions INTO v_base

    FROM public.role_templates

    WHERE tenant_id = v_tenant_id AND professional_type = 'admin'

    LIMIT 1;

  ELSE

    SELECT permissions INTO v_base

    FROM public.role_templates

    WHERE tenant_id = v_tenant_id AND professional_type = v_prof_type

    LIMIT 1;

  END IF;



  v_base := COALESCE(v_base, '{}'::jsonb);



  -- Apply overrides (global, unit_id IS NULL)

  FOR v_resource, v_override IN

    SELECT po.resource, jsonb_build_object(

      'view', po.can_view,

      'create', po.can_create,

      'edit', po.can_edit,

      'delete', po.can_delete

    )

    FROM public.permission_overrides po

    WHERE po.tenant_id = v_tenant_id AND po.user_id = p_user_id AND po.unit_id IS NULL

  LOOP

    v_base := v_base || jsonb_build_object(v_resource, v_override);

  END LOOP;



  -- If readonly mode, strip create/edit/delete from all resources

  IF v_is_readonly AND NOT v_is_admin THEN

    FOR v_resource IN SELECT jsonb_object_keys(v_base) LOOP

      v_perm := v_base->v_resource;

      v_base := v_base || jsonb_build_object(

        v_resource, jsonb_build_object(

          'view', COALESCE((v_perm->>'view')::boolean, false),

          'create', false,

          'edit', false,

          'delete', false

        )

      );

    END LOOP;

  END IF;



  RETURN v_base;

END;

$function$;