CREATE OR REPLACE FUNCTION public.update_role_template_permissions(p_professional_type professional_type, p_permissions jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id UUID;

BEGIN

  SELECT tenant_id INTO v_tenant_id

  FROM public.profiles

  WHERE user_id = current_setting('app.current_user_id')::uuid

  LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado ou sem tenant';

  END IF;



  IF NOT public.is_tenant_admin(current_setting('app.current_user_id')::uuid, v_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem editar templates de permiss├úo';

  END IF;



  UPDATE public.role_templates

  SET permissions = p_permissions, updated_at = now()

  WHERE tenant_id = v_tenant_id AND professional_type = p_professional_type;



  RETURN FOUND;

END;

$function$;