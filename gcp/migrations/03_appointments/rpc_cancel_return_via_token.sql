CREATE OR REPLACE FUNCTION public.cancel_return_via_token(p_token text, p_reason text DEFAULT NULL::text)
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

  SET used_at = NOW(), action = 'cancelled'

  WHERE id = v_token_record.id;

  

  -- Atualizar status do retorno para 'cancelled'

  UPDATE return_reminders

  SET 

    status = 'cancelled',

    notes = COALESCE(notes || E'\n', '') || 'Cancelado pelo paciente' || 

            CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END

  WHERE id = v_token_record.return_id;

  

  RETURN true;

END;

$function$;