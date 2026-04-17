CREATE OR REPLACE FUNCTION public.tenant_plan_tier(p_tenant_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT CASE

    -- Sem plano definido

    WHEN s.plan IS NULL THEN 'starter'

    -- Legado: s├│ interval sem tier

    WHEN lower(s.plan) IN ('monthly','quarterly','annual') THEN 'solo'

    -- Extrair tier da key "tier_interval"

    ELSE CASE split_part(lower(s.plan), '_', 1)

      WHEN 'starter'  THEN 'starter'

      WHEN 'solo'     THEN 'solo'

      WHEN 'clinic'   THEN 'clinica'

      WHEN 'clinica'  THEN 'clinica'

      WHEN 'premium'  THEN 'premium'

      -- Legado

      WHEN 'basic'    THEN 'solo'

      WHEN 'pro'      THEN 'clinica'

      ELSE 'starter'

    END

  END

  FROM public.subscriptions s

  WHERE s.tenant_id = p_tenant_id

  LIMIT 1;

$function$;