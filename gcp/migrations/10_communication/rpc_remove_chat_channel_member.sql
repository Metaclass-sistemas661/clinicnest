CREATE OR REPLACE FUNCTION public.remove_chat_channel_member(p_channel_id uuid, p_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

BEGIN

  v_tenant_id := public.get_my_tenant_id();

  

  DELETE FROM public.chat_channel_members

  WHERE channel_id = p_channel_id 

    AND profile_id = p_profile_id

    AND EXISTS (

      SELECT 1 FROM public.chat_channels c

      WHERE c.id = p_channel_id AND c.tenant_id = v_tenant_id

    );

  

  RETURN true;

END;

$function$;