CREATE OR REPLACE FUNCTION public.tenant_within_client_limit(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  WITH trial_check AS (

    SELECT EXISTS (

      SELECT 1

      FROM public.subscriptions s

      WHERE s.tenant_id = p_tenant_id

        AND lower(s.status) = 'trialing'

        AND s.trial_end IS NOT NULL

        AND now() <= s.trial_end

    ) AS is_trialing

  ),

  tier AS (

    SELECT public.tenant_plan_tier(p_tenant_id) AS tier

  ),

  lim AS (

    SELECT CASE

      -- Trial: sem limite

      WHEN (SELECT is_trialing FROM trial_check) THEN NULL

      WHEN (SELECT tier FROM tier) = 'starter'  THEN 100

      WHEN (SELECT tier FROM tier) = 'solo'     THEN 500

      WHEN (SELECT tier FROM tier) = 'clinica'  THEN 3000

      WHEN (SELECT tier FROM tier) = 'premium'  THEN NULL

      ELSE 100

    END AS max_clients

  )

  SELECT

    (SELECT max_clients FROM lim) IS NULL

    OR (

      SELECT count(*)

      FROM public.patients p

      WHERE p.tenant_id = p_tenant_id

    ) < (SELECT max_clients FROM lim);

$function$;