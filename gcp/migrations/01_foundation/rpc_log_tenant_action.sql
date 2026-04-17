CREATE OR REPLACE FUNCTION public.log_tenant_action(p_tenant_id uuid, p_actor_user_id uuid, p_action text, p_entity_type text, p_entity_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_log_id uuid;

  v_actor_role text;

BEGIN

  IF p_tenant_id IS NULL THEN

    RAISE EXCEPTION 'tenant_id ├® obrigat├│rio';

  END IF;



  IF p_action IS NULL OR btrim(p_action) = '' THEN

    RAISE EXCEPTION 'A├º├úo de auditoria ├® obrigat├│ria';

  END IF;



  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN

    RAISE EXCEPTION 'Tipo de entidade ├® obrigat├│rio';

  END IF;



  -- If called from a client session, ensure the actor belongs to tenant.

  IF current_setting('app.current_user_id')::uuid IS NOT NULL THEN

    IF p_actor_user_id IS NULL THEN

      p_actor_user_id := current_setting('app.current_user_id')::uuid;

    END IF;



    IF NOT EXISTS (

      SELECT 1

      FROM public.profiles p

      WHERE p.user_id = p_actor_user_id

        AND p.tenant_id = p_tenant_id

    ) THEN

      RAISE EXCEPTION 'Usu├írio n├úo pertence ao tenant';

    END IF;

  END IF;



  SELECT ur.role::text INTO v_actor_role

  FROM public.user_roles ur

  WHERE ur.user_id = p_actor_user_id

    AND ur.tenant_id = p_tenant_id

  LIMIT 1;



  INSERT INTO public.audit_logs (

    tenant_id,

    actor_user_id,

    actor_role,

    action,

    entity_type,

    entity_id,

    metadata

  ) VALUES (

    p_tenant_id,

    p_actor_user_id,

    v_actor_role,

    p_action,

    p_entity_type,

    p_entity_id,

    COALESCE(p_metadata, '{}'::jsonb)

  )

  RETURNING id INTO v_log_id;



  RETURN v_log_id;

END;

$function$;