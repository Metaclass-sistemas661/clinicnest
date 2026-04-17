CREATE OR REPLACE FUNCTION public.mark_chat_as_read(p_channel text, p_channel_id uuid DEFAULT NULL::uuid, p_message_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_profile_id UUID;

BEGIN

  v_profile_id := public.get_my_profile_id();

  

  IF v_profile_id IS NULL THEN

    RETURN false;

  END IF;

  

  IF p_channel_id IS NOT NULL THEN

    INSERT INTO public.chat_read_status (profile_id, channel, channel_id, last_read_at, last_read_message_id)

    VALUES (v_profile_id, p_channel, p_channel_id, now(), p_message_id)

    ON CONFLICT (profile_id, channel_id) DO UPDATE SET

      last_read_at = now(),

      last_read_message_id = COALESCE(p_message_id, chat_read_status.last_read_message_id);

  ELSE

    INSERT INTO public.chat_read_status (profile_id, channel, last_read_at, last_read_message_id)

    VALUES (v_profile_id, p_channel, now(), p_message_id)

    ON CONFLICT (profile_id, channel) DO UPDATE SET

      last_read_at = now(),

      last_read_message_id = COALESCE(p_message_id, chat_read_status.last_read_message_id);

  END IF;

  

  RETURN true;

END;

$function$;