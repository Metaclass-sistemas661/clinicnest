-- ============================================================================
-- FIX: Renomear client_id → patient_id na tabela patient_messages
-- e recriar todas as RPCs, RLS policies e indexes
-- ============================================================================

-- Coluna já foi renomeada via CLI, apenas garantir:
-- ALTER TABLE public.patient_messages RENAME COLUMN client_id TO patient_id;
-- (já aplicado)

-- Recriar indexes com nome correto
DROP INDEX IF EXISTS idx_patient_messages_client;
DROP INDEX IF EXISTS idx_patient_messages_created;
DROP INDEX IF EXISTS idx_patient_messages_unread;

CREATE INDEX IF NOT EXISTS idx_patient_messages_patient ON public.patient_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_created ON public.patient_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_messages_unread ON public.patient_messages(patient_id, read_at) WHERE read_at IS NULL;

-- Recriar RLS policies usando patient_id
DROP POLICY IF EXISTS "patient_messages_patient_select" ON public.patient_messages;
CREATE POLICY "patient_messages_patient_select" ON public.patient_messages
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

DROP POLICY IF EXISTS "patient_messages_patient_insert" ON public.patient_messages;
CREATE POLICY "patient_messages_patient_insert" ON public.patient_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'patient' AND
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

DROP POLICY IF EXISTS "patient_messages_tenant_all" ON public.patient_messages;
CREATE POLICY "patient_messages_tenant_all" ON public.patient_messages
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 3) RPC: Enviar mensagem do paciente
CREATE OR REPLACE FUNCTION public.send_patient_message(p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_patient_id uuid;
  v_tenant_id uuid;
  v_patient_name text;
  v_message_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_content IS NULL OR BTRIM(p_content) = '' THEN
    RAISE EXCEPTION 'Mensagem não pode estar vazia';
  END IF;

  IF char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Mensagem muito longa (máximo 2000 caracteres)';
  END IF;

  SELECT pp.client_id, pp.tenant_id, c.name INTO v_patient_id, v_tenant_id, v_patient_name
  FROM public.patient_profiles pp
  JOIN public.clients c ON c.id = pp.client_id
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
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
    v_patient_id,
    'patient',
    v_patient_user_id,
    v_patient_name,
    BTRIM(p_content)
  )
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_message_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_patient_message(text) TO authenticated;

-- 4) RPC: Obter mensagens do paciente
CREATE OR REPLACE FUNCTION public.get_patient_messages(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  sender_type text,
  sender_name text,
  content text,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_patient_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id INTO v_patient_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  -- Marcar mensagens da clínica como lidas
  UPDATE public.patient_messages pm
  SET read_at = now()
  WHERE pm.patient_id = v_patient_id
    AND pm.sender_type = 'clinic'
    AND pm.read_at IS NULL;

  RETURN QUERY
  SELECT 
    pm.id,
    pm.sender_type,
    pm.sender_name,
    pm.content,
    pm.read_at,
    pm.created_at
  FROM public.patient_messages pm
  WHERE pm.patient_id = v_patient_id
  ORDER BY pm.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_messages(integer, integer) TO authenticated;

-- 5) RPC: Contar mensagens não lidas (para badge)
CREATE OR REPLACE FUNCTION public.get_patient_unread_messages_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_patient_id uuid;
  v_count integer;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT pp.client_id INTO v_patient_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.patient_messages pm
  WHERE pm.patient_id = v_patient_id
    AND pm.sender_type = 'clinic'
    AND pm.read_at IS NULL;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_unread_messages_count() TO authenticated;

-- 6) RPC: Enviar mensagem da clínica para paciente (admin/staff)
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

GRANT EXECUTE ON FUNCTION public.send_clinic_message_to_patient(uuid, text) TO authenticated;

-- 7) RPC: Listar conversas (para admin)
CREATE OR REPLACE FUNCTION public.get_patient_conversations()
RETURNS TABLE (
  patient_id uuid,
  client_name text,
  last_message text,
  last_message_at timestamptz,
  last_sender_type text,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT p.tenant_id INTO v_tenant_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a tenant';
  END IF;

  RETURN QUERY
  WITH last_messages AS (
    SELECT DISTINCT ON (pm.patient_id)
      pm.patient_id,
      pm.content as last_message,
      pm.created_at as last_message_at,
      pm.sender_type as last_sender_type
    FROM public.patient_messages pm
    WHERE pm.tenant_id = v_tenant_id
    ORDER BY pm.patient_id, pm.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      pm.patient_id,
      COUNT(*) as unread_count
    FROM public.patient_messages pm
    WHERE pm.tenant_id = v_tenant_id
      AND pm.sender_type = 'patient'
      AND pm.read_at IS NULL
    GROUP BY pm.patient_id
  )
  SELECT 
    c.id as patient_id,
    c.name as client_name,
    lm.last_message,
    lm.last_message_at,
    lm.last_sender_type,
    COALESCE(uc.unread_count, 0) as unread_count
  FROM public.clients c
  JOIN last_messages lm ON lm.patient_id = c.id
  LEFT JOIN unread_counts uc ON uc.patient_id = c.id
  WHERE c.tenant_id = v_tenant_id
  ORDER BY lm.last_message_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_conversations() TO authenticated;

-- 8) RPC: Obter mensagens de um paciente específico (para admin)
CREATE OR REPLACE FUNCTION public.get_messages_for_patient(
  p_client_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  sender_type text,
  sender_name text,
  content text,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_patient_tenant_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT p.tenant_id INTO v_tenant_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT c.tenant_id INTO v_patient_tenant_id
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_patient_tenant_id IS NULL OR v_patient_tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  -- Marcar mensagens do paciente como lidas
  UPDATE public.patient_messages pm
  SET read_at = now()
  WHERE pm.patient_id = p_client_id
    AND pm.sender_type = 'patient'
    AND pm.read_at IS NULL;

  RETURN QUERY
  SELECT 
    pm.id,
    pm.sender_type,
    pm.sender_name,
    pm.content,
    pm.read_at,
    pm.created_at
  FROM public.patient_messages pm
  WHERE pm.patient_id = p_client_id
  ORDER BY pm.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_messages_for_patient(uuid, integer) TO authenticated;
