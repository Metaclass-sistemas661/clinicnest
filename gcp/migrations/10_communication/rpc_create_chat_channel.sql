CREATE OR REPLACE FUNCTION public.create_chat_channel(p_name text, p_description text DEFAULT NULL::text, p_is_private boolean DEFAULT false, p_member_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

  v_profile_id UUID;

  v_channel_id UUID;

  v_member_id UUID;

BEGIN

  v_tenant_id := public.get_my_tenant_id();

  v_profile_id := public.get_my_profile_id();

  

  IF v_tenant_id IS NULL OR v_profile_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;

  

  INSERT INTO public.chat_channels (tenant_id, name, description, is_private, created_by)

  VALUES (v_tenant_id, p_name, p_description, p_is_private, v_profile_id)

  RETURNING id INTO v_channel_id;

  

  -- Adicionar criador como membro se for privado

  IF p_is_private THEN

    INSERT INTO public.chat_channel_members (channel_id, profile_id)

    VALUES (v_channel_id, v_profile_id)

    ON CONFLICT DO NOTHING;

    

    -- Adicionar membros especificados

    FOREACH v_member_id IN ARRAY p_member_ids LOOP

      INSERT INTO public.chat_channel_members (channel_id, profile_id)

      VALUES (v_channel_id, v_member_id)

      ON CONFLICT DO NOTHING;

    END LOOP;

  END IF;

  

  RETURN v_channel_id;

END;

$function$;