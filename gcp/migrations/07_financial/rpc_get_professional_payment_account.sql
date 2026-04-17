CREATE OR REPLACE FUNCTION public.get_professional_payment_account(p_tenant_id uuid, p_professional_id uuid)
 RETURNS TABLE(id uuid, provider payment_gateway_provider, recipient_id text, wallet_id text, account_id text, is_verified boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

    v_gateway_id UUID;

BEGIN

    -- Buscar gateway ativo do tenant

    SELECT g.id INTO v_gateway_id

    FROM public.tenant_payment_gateways g

    WHERE g.tenant_id = p_tenant_id

    AND g.is_active = TRUE

    AND g.validation_status = 'valid'

    LIMIT 1;



    IF v_gateway_id IS NULL THEN

        RETURN;

    END IF;



    RETURN QUERY

    SELECT 

        pa.id,

        pa.provider,

        pa.recipient_id,

        pa.wallet_id,

        pa.account_id,

        pa.is_verified

    FROM public.professional_payment_accounts pa

    WHERE pa.tenant_id = p_tenant_id

    AND pa.professional_id = p_professional_id

    AND pa.gateway_id = v_gateway_id

    AND pa.is_verified = TRUE

    LIMIT 1;

END;

$function$;