CREATE OR REPLACE FUNCTION public.get_patient_conversations()
 RETURNS TABLE(patient_id uuid, client_name text, last_message text, last_message_at timestamp with time zone, last_sender_type text, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid;

  v_tenant_id uuid;

BEGIN

  v_user_id := current_setting('app.current_user_id')::uuid;

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'N├úo autenticado';

  END IF;



  SELECT p.tenant_id INTO v_tenant_id

  FROM public.profiles p

  WHERE p.id = v_user_id;



  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo vinculado a tenant';

  END IF;



  RETURN QUERY

  WITH last_messages AS (

    SELECT DISTINCT ON (pm.patient_id)

      pm.patient_id,

      pm.content as last_message,

      pm.created_at as last_message_at,

      pm.sender_type as last_sender_type

    FROM public.patient_messages pm

    WHERE pm.tenant_id = v_tenant_id

    ORDER BY pm.patient_id, pm.created_at DESC

  ),

  unread_counts AS (

    SELECT 

      pm.patient_id,

      COUNT(*) as unread_count

    FROM public.patient_messages pm

    WHERE pm.tenant_id = v_tenant_id

      AND pm.sender_type = 'patient'

      AND pm.read_at IS NULL

    GROUP BY pm.patient_id

  )

  SELECT 

    c.id as patient_id,

    c.name as client_name,

    lm.last_message,

    lm.last_message_at,

    lm.last_sender_type,

    COALESCE(uc.unread_count, 0) as unread_count

  FROM public.clients c

  JOIN last_messages lm ON lm.patient_id = c.id

  LEFT JOIN unread_counts uc ON uc.patient_id = c.id

  WHERE c.tenant_id = v_tenant_id

  ORDER BY lm.last_message_at DESC;

END;

$function$;