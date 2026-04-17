CREATE OR REPLACE FUNCTION public.get_unread_chat_count(p_channel text DEFAULT NULL::text, p_channel_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

  v_profile_id UUID;

  v_last_read TIMESTAMPTZ;

  v_count INTEGER;

BEGIN

  v_tenant_id := public.get_my_tenant_id();

  v_profile_id := public.get_my_profile_id();

  

  IF v_tenant_id IS NULL OR v_profile_id IS NULL THEN

    RETURN 0;

  END IF;

  

  -- Obter ├║ltima leitura

  IF p_channel_id IS NOT NULL THEN

    SELECT last_read_at INTO v_last_read

    FROM public.chat_read_status

    WHERE profile_id = v_profile_id AND channel_id = p_channel_id;

  ELSIF p_channel IS NOT NULL THEN

    SELECT last_read_at INTO v_last_read

    FROM public.chat_read_status

    WHERE profile_id = v_profile_id AND channel = p_channel;

  END IF;

  

  -- Contar mensagens ap├│s ├║ltima leitura

  IF p_channel IS NOT NULL THEN

    SELECT COUNT(*) INTO v_count

    FROM public.internal_messages

    WHERE tenant_id = v_tenant_id

      AND channel = p_channel

      AND sender_id != v_profile_id

      AND deleted_at IS NULL

      AND (v_last_read IS NULL OR created_at > v_last_read);

  ELSE

    -- Total de n├úo lidas em todos os canais

    SELECT COUNT(*) INTO v_count

    FROM public.internal_messages m

    LEFT JOIN public.chat_read_status r ON r.profile_id = v_profile_id AND r.channel = m.channel

    WHERE m.tenant_id = v_tenant_id

      AND m.sender_id != v_profile_id

      AND m.deleted_at IS NULL

      AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at);

  END IF;

  

  RETURN COALESCE(v_count, 0);

END;

$function$;