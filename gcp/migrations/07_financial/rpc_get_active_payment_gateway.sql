CREATE OR REPLACE FUNCTION public.get_active_payment_gateway(p_tenant_id uuid)
 RETURNS TABLE(id uuid, provider payment_gateway_provider, api_key_encrypted text, webhook_secret_encrypted text, environment text, is_split_enabled boolean, split_fee_payer text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN

    RETURN QUERY

    SELECT 

        g.id,

        g.provider,

        g.api_key_encrypted,

        g.webhook_secret_encrypted,

        g.environment,

        g.is_split_enabled,

        g.split_fee_payer

    FROM public.tenant_payment_gateways g

    WHERE g.tenant_id = p_tenant_id

    AND g.is_active = TRUE

    AND g.validation_status = 'valid'

    ORDER BY g.updated_at DESC

    LIMIT 1;

END;

$function$;