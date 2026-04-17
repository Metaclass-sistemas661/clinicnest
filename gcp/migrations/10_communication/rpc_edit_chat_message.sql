CREATE OR REPLACE FUNCTION public.edit_chat_message(p_message_id uuid, p_content text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_profile_id UUID;

BEGIN

  v_profile_id := public.get_my_profile_id();

  

  UPDATE public.internal_messages

  SET content = p_content, edited_at = now()

  WHERE id = p_message_id 

    AND sender_id = v_profile_id

    AND deleted_at IS NULL;

  

  RETURN FOUND;

END;

$function$;