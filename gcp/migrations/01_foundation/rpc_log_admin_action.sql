CREATE OR REPLACE FUNCTION public.log_admin_action(p_tenant_id uuid, p_action text, p_entity_type text, p_entity_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_actor_user_id UUID := current_setting('app.current_user_id')::uuid;

  v_log_id UUID;

BEGIN

  IF v_actor_user_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF p_action IS NULL OR btrim(p_action) = '' THEN

    RAISE EXCEPTION 'A├º├úo de auditoria ├® obrigat├│ria';

  END IF;



  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN

    RAISE EXCEPTION 'Tipo de entidade ├® obrigat├│rio';

  END IF;



  IF NOT public.is_tenant_admin(v_actor_user_id, p_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem registrar trilha de auditoria';

  END IF;



  INSERT INTO public.admin_audit_logs (

    tenant_id,

    actor_user_id,

    action,

    entity_type,

    entity_id,

    metadata

  ) VALUES (

    p_tenant_id,

    v_actor_user_id,

    p_action,

    p_entity_type,

    p_entity_id,

    COALESCE(p_metadata, '{}'::jsonb)

  )

  RETURNING id INTO v_log_id;



  RETURN v_log_id;

END;

$function$;