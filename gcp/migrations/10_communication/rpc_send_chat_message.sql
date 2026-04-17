CREATE OR REPLACE FUNCTION public.send_chat_message(p_channel text, p_channel_id uuid DEFAULT NULL::uuid, p_content text DEFAULT ''::text, p_mentions uuid[] DEFAULT '{}'::uuid[], p_attachments jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

  v_profile_id UUID;

  v_message_id UUID;

  v_mention_id UUID;

  v_mention_user_id UUID;

BEGIN

  v_tenant_id := public.get_my_tenant_id();

  v_profile_id := public.get_my_profile_id();

  

  IF v_tenant_id IS NULL OR v_profile_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado' USING DETAIL = 'UNAUTHENTICATED';

  END IF;

  

  INSERT INTO public.internal_messages (

    tenant_id, sender_id, channel, channel_id, content, mentions, attachments

  )

  VALUES (

    v_tenant_id, v_profile_id, p_channel, p_channel_id, p_content, p_mentions, p_attachments

  )

  RETURNING id INTO v_message_id;

  

  -- Criar notifica├º├Áes para mencionados (colunas corrigidas: user_id, body, metadata)

  FOREACH v_mention_id IN ARRAY p_mentions LOOP

    -- Buscar user_id do profile mencionado

    SELECT pr.user_id INTO v_mention_user_id

    FROM public.profiles pr

    WHERE pr.id = v_mention_id;

    

    IF v_mention_user_id IS NOT NULL THEN

      INSERT INTO public.notifications (

        tenant_id, user_id, type, title, body, metadata

      )

      VALUES (

        v_tenant_id,

        v_mention_user_id,

        'chat_mention',

        'Voc├¬ foi mencionado no chat',

        substring(p_content, 1, 100),

        jsonb_build_object('message_id', v_message_id, 'channel', p_channel, 'sender_id', v_profile_id)

      )

      ON CONFLICT DO NOTHING;

    END IF;

  END LOOP;

  

  RETURN v_message_id;

END;

$function$;