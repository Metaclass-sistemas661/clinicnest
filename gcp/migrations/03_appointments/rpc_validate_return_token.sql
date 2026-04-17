CREATE OR REPLACE FUNCTION public.validate_return_token(p_token text)
 RETURNS TABLE(valid boolean, return_id uuid, tenant_id uuid, client_id uuid, client_name text, professional_name text, return_date date, reason text, status text, clinic_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_token_record RECORD;

BEGIN

  -- Buscar token

  SELECT 

    rct.*,

    rr.client_id,

    rr.professional_id,

    rr.return_date,

    rr.reason,

    rr.status as return_status

  INTO v_token_record

  FROM return_confirmation_tokens rct

  JOIN return_reminders rr ON rr.id = rct.return_id

  WHERE rct.token = p_token;

  

  IF NOT FOUND THEN

    RETURN QUERY SELECT 

      false::BOOLEAN, 

      NULL::UUID, NULL::UUID, NULL::UUID, 

      NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::TEXT;

    RETURN;

  END IF;

  

  -- Verificar se expirou ou j├í foi usado

  IF v_token_record.expires_at < NOW() OR v_token_record.used_at IS NOT NULL THEN

    RETURN QUERY SELECT 

      false::BOOLEAN, 

      NULL::UUID, NULL::UUID, NULL::UUID, 

      NULL::TEXT, NULL::TEXT, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::TEXT;

    RETURN;

  END IF;

  

  -- Buscar dados adicionais

  RETURN QUERY

  SELECT 

    true::BOOLEAN as valid,

    v_token_record.return_id,

    v_token_record.tenant_id,

    v_token_record.client_id,

    c.name::TEXT as client_name,

    COALESCE(p.full_name, '')::TEXT as professional_name,

    v_token_record.return_date,

    v_token_record.reason::TEXT,

    v_token_record.return_status::TEXT as status,

    t.name::TEXT as clinic_name

  FROM clients c

  LEFT JOIN profiles p ON p.id = v_token_record.professional_id

  LEFT JOIN tenants t ON t.id = v_token_record.tenant_id

  WHERE c.id = v_token_record.client_id;

END;

$function$;