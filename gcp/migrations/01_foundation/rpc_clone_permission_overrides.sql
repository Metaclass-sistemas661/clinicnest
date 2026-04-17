CREATE OR REPLACE FUNCTION public.clone_permission_overrides(p_source_user_id uuid, p_target_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id UUID;

  v_count INT := 0;

BEGIN

  SELECT tenant_id INTO v_tenant_id

  FROM public.profiles

  WHERE user_id = current_setting('app.current_user_id')::uuid

  LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado ou sem tenant';

  END IF;



  IF NOT public.is_tenant_admin(current_setting('app.current_user_id')::uuid, v_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem clonar permiss├Áes';

  END IF;



  -- Verify both users belong to same tenant

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_source_user_id AND tenant_id = v_tenant_id) THEN

    RAISE EXCEPTION 'Usu├írio de origem n├úo pertence ao tenant';

  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id) THEN

    RAISE EXCEPTION 'Usu├írio de destino n├úo pertence ao tenant';

  END IF;



  -- Delete existing overrides for target

  DELETE FROM public.permission_overrides

  WHERE tenant_id = v_tenant_id AND user_id = p_target_user_id;



  -- Copy from source to target

  INSERT INTO public.permission_overrides (tenant_id, user_id, resource, can_view, can_create, can_edit, can_delete, unit_id)

  SELECT v_tenant_id, p_target_user_id, resource, can_view, can_create, can_edit, can_delete, unit_id

  FROM public.permission_overrides

  WHERE tenant_id = v_tenant_id AND user_id = p_source_user_id;



  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;

END;

$function$;