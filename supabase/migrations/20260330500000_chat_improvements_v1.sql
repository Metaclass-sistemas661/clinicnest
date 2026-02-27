-- ============================================================================
-- FASE 42: Melhorias no Chat Interno
-- ============================================================================
-- Funcionalidades:
-- 1. Canais customizados (públicos e privados)
-- 2. Membros de canais privados
-- 3. Menções (@usuario)
-- 4. Anexos (imagens/arquivos)
-- 5. Mensagens não lidas
-- 6. Busca full-text
-- 7. Edição/exclusão de mensagens
-- ============================================================================

-- 1. Tabela de canais customizados
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_tenant ON public.chat_channels(tenant_id);

-- 2. Tabela de membros de canais privados
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel ON public.chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_profile ON public.chat_channel_members(profile_id);

-- 3. Adicionar colunas à tabela internal_messages
DO $$ BEGIN
  -- Referência ao canal customizado (opcional, para compatibilidade)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_messages' AND column_name = 'channel_id') THEN
    ALTER TABLE public.internal_messages ADD COLUMN channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE;
  END IF;
  
  -- Menções (array de profile_ids)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_messages' AND column_name = 'mentions') THEN
    ALTER TABLE public.internal_messages ADD COLUMN mentions UUID[] DEFAULT '{}';
  END IF;
  
  -- Anexos (JSONB com metadados)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_messages' AND column_name = 'attachments') THEN
    ALTER TABLE public.internal_messages ADD COLUMN attachments JSONB DEFAULT '[]';
  END IF;
  
  -- Edição
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_messages' AND column_name = 'edited_at') THEN
    ALTER TABLE public.internal_messages ADD COLUMN edited_at TIMESTAMPTZ;
  END IF;
  
  -- Soft delete
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_messages' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.internal_messages ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_internal_messages_channel_id ON public.internal_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_mentions ON public.internal_messages USING GIN(mentions);

-- 4. Tabela de mensagens lidas (para tracking de não lidas)
CREATE TABLE IF NOT EXISTS public.chat_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_message_id UUID REFERENCES public.internal_messages(id) ON DELETE SET NULL,
  UNIQUE(profile_id, channel),
  UNIQUE(profile_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_read_status_profile ON public.chat_read_status(profile_id);

-- 5. Full-text search index
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_internal_messages_content_fts') THEN
    CREATE INDEX idx_internal_messages_content_fts ON public.internal_messages 
      USING GIN(to_tsvector('portuguese', content));
  END IF;
END $$;

-- 6. Trigger para updated_at em chat_channels
CREATE OR REPLACE FUNCTION public.handle_chat_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_channels_updated_at ON public.chat_channels;
CREATE TRIGGER trg_chat_channels_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_chat_channels_updated_at();

-- 7. RLS para chat_channels
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_channels_tenant_isolation" ON public.chat_channels;
CREATE POLICY "chat_channels_tenant_isolation" ON public.chat_channels
  FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 8. RLS para chat_channel_members
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_channel_members_access" ON public.chat_channel_members;
CREATE POLICY "chat_channel_members_access" ON public.chat_channel_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = channel_id AND c.tenant_id = public.get_my_tenant_id()
    )
  );

-- 9. RLS para chat_read_status
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_read_status_own" ON public.chat_read_status;
CREATE POLICY "chat_read_status_own" ON public.chat_read_status
  FOR ALL USING (profile_id = public.get_my_profile_id());

-- 10. Função para criar canal
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

-- 11. Função para adicionar membro a canal privado
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

-- 12. Função para remover membro de canal privado
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

-- 13. Função para enviar mensagem com menções
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
  
  -- Criar notificações para mencionados
  FOREACH v_mention_id IN ARRAY p_mentions LOOP
    INSERT INTO public.notifications (
      tenant_id, profile_id, type, title, message, data
    )
    VALUES (
      v_tenant_id,
      v_mention_id,
      'chat_mention',
      'Você foi mencionado no chat',
      substring(p_content, 1, 100),
      jsonb_build_object('message_id', v_message_id, 'channel', p_channel, 'sender_id', v_profile_id)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RETURN v_message_id;
END;
$$;

-- 14. Função para marcar mensagens como lidas
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

-- 15. Função para contar mensagens não lidas
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

-- 16. Função para buscar mensagens (full-text search)
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

-- 17. Função para editar mensagem
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

-- 18. Função para excluir mensagem (soft delete)
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

-- 19. Criar canal "Geral" padrão para tenants existentes
DO $$
DECLARE
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN SELECT id FROM public.tenants LOOP
    INSERT INTO public.chat_channels (tenant_id, name, description, is_default)
    VALUES (v_tenant.id, 'Geral', 'Canal geral da equipe', true)
    ON CONFLICT (tenant_id, name) DO NOTHING;
  END LOOP;
END $$;

-- 20. Trigger para criar canal "Geral" em novos tenants
CREATE OR REPLACE FUNCTION public.handle_new_tenant_chat_channel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_channels (tenant_id, name, description, is_default)
  VALUES (NEW.id, 'Geral', 'Canal geral da equipe', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_new_tenant_chat_channel ON public.tenants;
CREATE TRIGGER trg_new_tenant_chat_channel
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_chat_channel();

-- 21. Comentários
COMMENT ON TABLE public.chat_channels IS 'Canais de chat customizados por tenant (Fase 42)';
COMMENT ON TABLE public.chat_channel_members IS 'Membros de canais privados (Fase 42)';
COMMENT ON TABLE public.chat_read_status IS 'Status de leitura de mensagens por usuário (Fase 42)';
COMMENT ON FUNCTION public.send_chat_message IS 'Envia mensagem com suporte a menções e anexos (Fase 42)';
COMMENT ON FUNCTION public.get_unread_chat_count IS 'Retorna contagem de mensagens não lidas (Fase 42)';
COMMENT ON FUNCTION public.search_chat_messages IS 'Busca full-text em mensagens do chat (Fase 42)';
