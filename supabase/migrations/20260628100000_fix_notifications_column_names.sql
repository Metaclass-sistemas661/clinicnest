-- ============================================================================
-- FIX: Corrigir nomes de colunas em INSERTs na tabela notifications
-- ============================================================================
-- A tabela public.notifications usa: user_id, body, metadata
-- Duas funções usavam erroneamente: profile_id, message, data
-- Erro: column "message" of relation "notifications" does not exist (42703)
-- ============================================================================

-- ─── 1. Corrigir auto_add_to_queue_on_checkin ───────────────────────────────
-- Trigger AFTER UPDATE OF status ON appointments
-- Dispara ao fazer check-in (status → 'arrived')
-- Erro: usava "message" e "data" ao invés de "body" e "metadata"

CREATE OR REPLACE FUNCTION auto_add_to_queue_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auto_queue BOOLEAN;
  v_already_in_queue BOOLEAN;
  v_priority INTEGER;
  v_priority_label TEXT;
  v_call_id UUID;
BEGIN
  -- Só processa se mudou para 'arrived'
  IF NEW.status::TEXT != 'arrived' OR (OLD IS NOT NULL AND OLD.status::TEXT = 'arrived') THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se tenant tem auto-queue habilitado
  SELECT auto_queue_on_checkin INTO v_auto_queue
  FROM tenants
  WHERE id = NEW.tenant_id;
  
  IF NOT COALESCE(v_auto_queue, true) THEN
    RETURN NEW;
  END IF;
  
  -- Verifica se já está na fila hoje
  SELECT EXISTS(
    SELECT 1 FROM patient_calls
    WHERE tenant_id = NEW.tenant_id
      AND patient_id = NEW.patient_id
      AND created_at::DATE = CURRENT_DATE
      AND status IN ('waiting', 'calling', 'in_service')
  ) INTO v_already_in_queue;
  
  IF v_already_in_queue THEN
    RETURN NEW;
  END IF;
  
  -- Obtém prioridade do paciente
  SELECT gpp.priority, gpp.priority_label INTO v_priority, v_priority_label
  FROM get_patient_priority(NEW.patient_id) gpp;
  
  -- Adiciona à fila
  SELECT add_patient_to_queue(
    NEW.tenant_id,
    NEW.patient_id,
    NEW.id,
    NULL,
    NULL,
    NEW.professional_id,
    COALESCE(v_priority, 5),
    v_priority_label
  ) INTO v_call_id;
  
  -- Cria notificação para o profissional (colunas corrigidas: body, metadata)
  IF NEW.professional_id IS NOT NULL AND v_call_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      tenant_id,
      type,
      title,
      body,
      metadata
    )
    SELECT 
      p.user_id,
      NEW.tenant_id,
      'paciente_chegou',
      'Paciente Chegou',
      c.name || ' fez check-in e está aguardando',
      jsonb_build_object(
        'patient_id', NEW.patient_id,
        'patient_name', c.name,
        'appointment_id', NEW.id,
        'call_id', v_call_id,
        'priority', v_priority,
        'priority_label', v_priority_label
      )
    FROM profiles p
    JOIN patients c ON c.id = NEW.patient_id
    WHERE p.id = NEW.professional_id
      AND p.user_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ─── 2. Corrigir send_chat_message ──────────────────────────────────────────
-- Usava profile_id (não existe), message e data
-- Corrigido para: user_id (via subquery), body e metadata

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
