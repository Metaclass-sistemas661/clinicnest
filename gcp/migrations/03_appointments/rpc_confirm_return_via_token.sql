CREATE OR REPLACE FUNCTION public.confirm_return_via_token(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_token_record RECORD;

BEGIN

  -- Buscar e validar token

  SELECT rct.*, rr.status as return_status

  INTO v_token_record

  FROM return_confirmation_tokens rct

  JOIN return_reminders rr ON rr.id = rct.return_id

  WHERE rct.token = p_token

    AND rct.expires_at > NOW()

    AND rct.used_at IS NULL;

  

  IF NOT FOUND THEN

    RETURN false;

  END IF;

  

  -- Marcar token como usado

  UPDATE return_confirmation_tokens

  SET used_at = NOW(), action = 'confirmed'

  WHERE id = v_token_record.id;

  

  -- Atualizar status do retorno para 'scheduled' (confirmado pelo paciente)

  UPDATE return_reminders

  SET status = 'scheduled'

  WHERE id = v_token_record.return_id;

  

  RETURN true;

END;

$function$;