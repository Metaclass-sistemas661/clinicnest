CREATE OR REPLACE FUNCTION public.add_chat_channel_member(p_channel_id uuid, p_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

  v_is_private BOOLEAN;

BEGIN

  v_tenant_id := public.get_my_tenant_id();

  

  SELECT is_private INTO v_is_private

  FROM public.chat_channels

  WHERE id = p_channel_id AND tenant_id = v_tenant_id;

  

  IF NOT FOUND THEN

    RAISE EXCEPTION 'Canal n├úo encontrado' USING DETAIL = 'NOT_FOUND';

  END IF;

  

  IF NOT v_is_private THEN

    RETURN true; -- Canais p├║blicos n├úo precisam de membros

  END IF;

  

  INSERT INTO public.chat_channel_members (channel_id, profile_id)

  VALUES (p_channel_id, p_profile_id)

  ON CONFLICT DO NOTHING;

  

  RETURN true;

END;

$function$;