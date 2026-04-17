CREATE OR REPLACE FUNCTION public.tenant_has_access(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT EXISTS (

    SELECT 1

    FROM public.subscriptions s

    WHERE s.tenant_id = p_tenant_id

      AND (

        lower(s.status) = 'active'

        OR (lower(s.status) = 'trialing' AND now() <= s.trial_end)

      )

    LIMIT 1

  );

$function$;