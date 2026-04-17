CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT CASE

    -- Trial ativo: tudo liberado

    WHEN EXISTS (

      SELECT 1

      FROM public.subscriptions s

      WHERE s.tenant_id = p_tenant_id

        AND lower(s.status) = 'trialing'

        AND s.trial_end IS NOT NULL

        AND now() <= s.trial_end

      LIMIT 1

    ) THEN true

    -- Premium: tudo liberado

    WHEN public.tenant_plan_tier(p_tenant_id) = 'premium' THEN true

    -- Cl├¡nica: features avan├ºadas

    WHEN public.tenant_plan_tier(p_tenant_id) = 'clinica' THEN

      lower(coalesce(p_feature, '')) IN (

        'pdf_export',

        'data_export',

        'advanced_reports',

        'whatsapp_support',

        'odontogram',

        'periogram',

        'tiss',

        'commissions',

        'sngpc',

        'custom_reports'

      )

    -- Solo: features b├ísicas

    WHEN public.tenant_plan_tier(p_tenant_id) = 'solo' THEN

      lower(coalesce(p_feature, '')) IN (

        'pdf_export',

        'data_export'

      )

    -- Starter: sem features avan├ºadas

    ELSE

      false

  END;

$function$;