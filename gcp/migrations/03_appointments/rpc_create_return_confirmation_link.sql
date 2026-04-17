CREATE OR REPLACE FUNCTION public.create_return_confirmation_link(p_tenant_id uuid, p_return_id uuid, p_expires_hours integer DEFAULT 72)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_token TEXT;

  v_exists BOOLEAN;

BEGIN

  -- Verificar se o retorno existe e pertence ao tenant

  SELECT EXISTS(

    SELECT 1 FROM return_reminders

    WHERE id = p_return_id AND tenant_id = p_tenant_id

  ) INTO v_exists;

  

  IF NOT v_exists THEN

    RAISE EXCEPTION 'Retorno n├úo encontrado';

  END IF;

  

  -- Verificar se j├í existe um token v├ílido

  SELECT token INTO v_token

  FROM return_confirmation_tokens

  WHERE return_id = p_return_id

    AND used_at IS NULL

    AND expires_at > NOW()

  LIMIT 1;

  

  IF v_token IS NOT NULL THEN

    RETURN v_token;

  END IF;

  

  -- Gerar novo token

  v_token := generate_return_confirmation_token();

  

  -- Garantir unicidade

  WHILE EXISTS(SELECT 1 FROM return_confirmation_tokens WHERE token = v_token) LOOP

    v_token := generate_return_confirmation_token();

  END LOOP;

  

  -- Inserir token

  INSERT INTO return_confirmation_tokens (

    tenant_id,

    return_id,

    token,

    expires_at

  ) VALUES (

    p_tenant_id,

    p_return_id,

    v_token,

    NOW() + (p_expires_hours || ' hours')::INTERVAL

  );

  

  RETURN v_token;

END;

$function$;