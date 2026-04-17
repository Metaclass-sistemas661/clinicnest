CREATE OR REPLACE FUNCTION public.get_clinical_access_report(p_start_date timestamp with time zone DEFAULT (now() - '30 days'::interval), p_end_date timestamp with time zone DEFAULT now(), p_professional_id uuid DEFAULT NULL::uuid, p_resource_filter text DEFAULT NULL::text, p_flagged_only boolean DEFAULT false, p_limit_rows integer DEFAULT 500)
 RETURNS TABLE(log_id uuid, created_at timestamp with time zone, actor_user_id uuid, actor_name text, actor_professional_type text, action text, resource text, resource_id text, patient_id text, patient_name text, is_flagged boolean, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_tenant_id uuid;

BEGIN

  SELECT p.tenant_id INTO v_tenant_id

    FROM public.profiles p

   WHERE p.user_id = v_user_id

   LIMIT 1;



  IF v_tenant_id IS NULL THEN

    RETURN;

  END IF;



  IF NOT public.is_tenant_admin(v_user_id, v_tenant_id) THEN

    RETURN;

  END IF;



  RETURN QUERY

  SELECT

    al.id AS log_id,

    al.created_at,

    al.actor_user_id,

    COALESCE(pr.full_name, 'Desconhecido') AS actor_name,

    COALESCE(al.metadata->>'professional_type', '') AS actor_professional_type,

    al.action,

    al.entity_type AS resource,

    al.entity_id AS resource_id,

    al.metadata->>'patient_id' AS patient_id,

    cl.name AS patient_name,

    COALESCE((al.metadata->>'is_flagged')::boolean, false) AS is_flagged,

    al.metadata

  FROM public.audit_logs al

  LEFT JOIN public.profiles pr

    ON pr.user_id = al.actor_user_id AND pr.tenant_id = v_tenant_id

  LEFT JOIN public.clients cl

    ON cl.id::text = al.metadata->>'patient_id' AND cl.tenant_id = v_tenant_id

  WHERE al.tenant_id = v_tenant_id

    AND al.action IN ('clinical_access', 'access_denied')

    AND al.created_at >= p_start_date

    AND al.created_at <= p_end_date

    AND (p_professional_id IS NULL OR al.actor_user_id = p_professional_id)

    AND (p_resource_filter IS NULL OR al.entity_type = p_resource_filter)

    AND (NOT p_flagged_only OR COALESCE((al.metadata->>'is_flagged')::boolean, false) = true)

  ORDER BY al.created_at DESC

  LIMIT p_limit_rows;

END;

$function$;