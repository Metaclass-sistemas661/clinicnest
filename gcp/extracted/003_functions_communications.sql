-- GCP Migration: Functions - communications
-- Total: 15 functions


-- ============================================
-- Function: support_messages_enforce_tenant_id
-- Source: 20260215170000_support_tickets.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.support_messages_enforce_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT t.tenant_id INTO NEW.tenant_id
    FROM public.support_tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = NEW.ticket_id
      AND t.tenant_id <> NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  UPDATE public.support_tickets
    SET last_message_at = now(),
        updated_at = now()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: check_contact_rate_limit
-- Source: 20260316100000_security_compliance_rls.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.check_contact_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  SELECT count(*) INTO v_recent_count
  FROM public.contact_messages
  WHERE email = NEW.email
    AND created_at > now() - interval '1 hour';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Try again later.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================
-- Function: get_user_fcm_tokens
-- Source: 20260324300000_push_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_user_fcm_tokens(p_user_id UUID)
RETURNS TABLE(fcm_token TEXT, platform VARCHAR, device_name VARCHAR)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT fcm_token, platform, device_name
  FROM push_subscriptions
  WHERE user_id = p_user_id
    AND is_active = true;
$$;


-- ============================================
-- Function: get_tenant_fcm_tokens
-- Source: 20260324300000_push_notifications_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_fcm_tokens(p_tenant_id UUID)
RETURNS TABLE(user_id UUID, fcm_token TEXT, platform VARCHAR)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT user_id, fcm_token, platform
  FROM push_subscriptions
  WHERE tenant_id = p_tenant_id
    AND is_active = true;
$$;


-- ============================================
-- Function: send_clinic_message_to_patient
-- Source: 20260326200001_fix_patient_messages_patient_id.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.send_clinic_message_to_patient(
  p_client_id uuid,
  p_content text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_sender_name text;
  v_patient_tenant_id uuid;
  v_message_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_content IS NULL OR BTRIM(p_content) = '' THEN
    RAISE EXCEPTION 'Mensagem não pode estar vazia';
  END IF;

  SELECT p.tenant_id, p.full_name INTO v_tenant_id, v_sender_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a tenant';
  END IF;

  SELECT c.tenant_id INTO v_patient_tenant_id
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_patient_tenant_id IS NULL OR v_patient_tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  INSERT INTO public.patient_messages (
    tenant_id,
    patient_id,
    sender_type,
    sender_user_id,
    sender_name,
    content
  ) VALUES (
    v_tenant_id,
    p_client_id,
    'clinic',
    v_user_id,
    v_sender_name,
    BTRIM(p_content)
  )
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_message_id
  );
END;
$$;


-- ============================================
-- Function: handle_chat_channels_updated_at
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_chat_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Function: create_chat_channel
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.create_chat_channel(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_is_private BOOLEAN DEFAULT false,
  p_member_ids UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_profile_id UUID;
  v_channel_id UUID;
  v_member_id UUID;
BEGIN
  v_tenant_id := public.get_my_tenant_id();
  v_profile_id := public.get_my_profile_id();
  
  IF v_tenant_id IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
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
$$;


-- ============================================
-- Function: add_chat_channel_member
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.add_chat_channel_member(
  p_channel_id UUID,
  p_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_private BOOLEAN;
BEGIN
  v_tenant_id := public.get_my_tenant_id();
  
  SELECT is_private INTO v_is_private
  FROM public.chat_channels
  WHERE id = p_channel_id AND tenant_id = v_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canal não encontrado' USING DETAIL = 'NOT_FOUND';
  END IF;
  
  IF NOT v_is_private THEN
    RETURN true; -- Canais públicos não precisam de membros
  END IF;
  
  INSERT INTO public.chat_channel_members (channel_id, profile_id)
  VALUES (p_channel_id, p_profile_id)
  ON CONFLICT DO NOTHING;
  
  RETURN true;
END;
$$;


-- ============================================
-- Function: remove_chat_channel_member
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.remove_chat_channel_member(
  p_channel_id UUID,
  p_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


-- ============================================
-- Function: send_chat_message
-- Source: 20260628100000_fix_notifications_column_names.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_channel TEXT,
  p_channel_id UUID DEFAULT NULL,
  p_content TEXT DEFAULT '',
  p_mentions UUID[] DEFAULT '{}',
  p_attachments JSONB DEFAULT '[]'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    RAISE EXCEPTION 'Usuário não autenticado' USING DETAIL = 'UNAUTHENTICATED';
  END IF;
  
  INSERT INTO public.internal_messages (
    tenant_id, sender_id, channel, channel_id, content, mentions, attachments
  )
  VALUES (
    v_tenant_id, v_profile_id, p_channel, p_channel_id, p_content, p_mentions, p_attachments
  )
  RETURNING id INTO v_message_id;
  
  -- Criar notificações para mencionados (colunas corrigidas: user_id, body, metadata)
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
        'Você foi mencionado no chat',
        substring(p_content, 1, 100),
        jsonb_build_object('message_id', v_message_id, 'channel', p_channel, 'sender_id', v_profile_id)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN v_message_id;
END;
$$;


-- ============================================
-- Function: mark_chat_as_read
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_chat_as_read(
  p_channel TEXT,
  p_channel_id UUID DEFAULT NULL,
  p_message_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


-- ============================================
-- Function: get_unread_chat_count
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_unread_chat_count(
  p_channel TEXT DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  
  -- Obter última leitura
  IF p_channel_id IS NOT NULL THEN
    SELECT last_read_at INTO v_last_read
    FROM public.chat_read_status
    WHERE profile_id = v_profile_id AND channel_id = p_channel_id;
  ELSIF p_channel IS NOT NULL THEN
    SELECT last_read_at INTO v_last_read
    FROM public.chat_read_status
    WHERE profile_id = v_profile_id AND channel = p_channel;
  END IF;
  
  -- Contar mensagens após última leitura
  IF p_channel IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.internal_messages
    WHERE tenant_id = v_tenant_id
      AND channel = p_channel
      AND sender_id != v_profile_id
      AND deleted_at IS NULL
      AND (v_last_read IS NULL OR created_at > v_last_read);
  ELSE
    -- Total de não lidas em todos os canais
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
$$;


-- ============================================
-- Function: search_chat_messages
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.search_chat_messages(
  p_query TEXT,
  p_channel TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  channel TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  sender_id UUID,
  sender_name TEXT,
  rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.get_my_tenant_id();
  
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    m.id,
    m.channel,
    m.content,
    m.created_at,
    m.sender_id,
    p.full_name AS sender_name,
    ts_rank(to_tsvector('portuguese', m.content), plainto_tsquery('portuguese', p_query)) AS rank
  FROM public.internal_messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.tenant_id = v_tenant_id
    AND m.deleted_at IS NULL
    AND to_tsvector('portuguese', m.content) @@ plainto_tsquery('portuguese', p_query)
    AND (p_channel IS NULL OR m.channel = p_channel)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$;


-- ============================================
-- Function: edit_chat_message
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.edit_chat_message(
  p_message_id UUID,
  p_content TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


-- ============================================
-- Function: delete_chat_message
-- Source: 20260330500000_chat_improvements_v1.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_chat_message(
  p_message_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  v_profile_id := public.get_my_profile_id();
  
  UPDATE public.internal_messages
  SET deleted_at = now()
  WHERE id = p_message_id 
    AND sender_id = v_profile_id
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

