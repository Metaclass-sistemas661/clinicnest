CREATE OR REPLACE FUNCTION public.set_user_readonly(p_target_user_id uuid, p_readonly boolean, p_reason text DEFAULT NULL::text)
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

    RAISE EXCEPTION 'Apenas administradores podem alterar modo somente leitura';

  END IF;



  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id) THEN

    RAISE EXCEPTION 'Usu├írio n├úo pertence ao tenant';

  END IF;



  UPDATE public.profiles

  SET 

    is_readonly = p_readonly,

    readonly_reason = CASE WHEN p_readonly THEN p_reason ELSE NULL END,

    readonly_since = CASE WHEN p_readonly THEN now() ELSE NULL END

  WHERE user_id = p_target_user_id AND tenant_id = v_tenant_id;



  RETURN FOUND;

END;

$function$;