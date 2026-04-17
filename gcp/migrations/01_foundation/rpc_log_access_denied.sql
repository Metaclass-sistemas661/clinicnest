CREATE OR REPLACE FUNCTION public.log_access_denied(p_resource text, p_action text DEFAULT 'view'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_tenant_id uuid;

  v_log_id uuid;

  v_professional_type text;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN NULL;

  END IF;



  SELECT p.tenant_id, p.professional_type::text

    INTO v_tenant_id, v_professional_type

    FROM public.profiles p

   WHERE p.user_id = v_user_id

   LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RETURN NULL;

  END IF;



  INSERT INTO public.audit_logs (

    tenant_id, actor_user_id, action, entity_type, entity_id, metadata

  ) VALUES (

    v_tenant_id,

    v_user_id,

    'access_denied',

    p_resource,

    NULL,

    jsonb_build_object(

      'attempted_action', p_action,

      'professional_type', v_professional_type,

      'source', 'frontend'

    ) || COALESCE(p_metadata, '{}'::jsonb)

  )

  RETURNING id INTO v_log_id;



  RETURN v_log_id;

END;

$function$;