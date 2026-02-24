-- ============================================================================
-- FASE 29C: Chat/Mensagens com a Clínica (Portal do Paciente)
-- ============================================================================

-- 1) Tabela de mensagens do paciente
CREATE TABLE IF NOT EXISTS public.patient_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  sender_type text NOT NULL CHECK (sender_type IN ('patient', 'clinic')),
  sender_user_id uuid,
  sender_name text,
  
  content text NOT NULL CHECK (char_length(content) <= 2000),
  
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_messages_tenant ON public.patient_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_client ON public.patient_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_created ON public.patient_messages(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_messages_unread ON public.patient_messages(client_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.patient_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Paciente vê suas mensagens
DROP POLICY IF EXISTS "patient_messages_patient_select" ON public.patient_messages;
CREATE POLICY "patient_messages_patient_select" ON public.patient_messages
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- RLS: Paciente pode inserir mensagens (sender_type = 'patient')
DROP POLICY IF EXISTS "patient_messages_patient_insert" ON public.patient_messages;
CREATE POLICY "patient_messages_patient_insert" ON public.patient_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'patient' AND
    client_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
  );

-- RLS: Admin/staff do tenant gerencia
DROP POLICY IF EXISTS "patient_messages_tenant_all" ON public.patient_messages;
CREATE POLICY "patient_messages_tenant_all" ON public.patient_messages
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 2) Tabela de templates de resposta rápida
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  title text NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 2000),
  category text,
  is_active boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_tenant ON public.message_templates(tenant_id);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates_tenant_all" ON public.message_templates;
CREATE POLICY "message_templates_tenant_all" ON public.message_templates
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
  v_client_id uuid;
  v_tenant_id uuid;
  v_client_name text;
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

  SELECT pp.client_id, pp.tenant_id, c.name INTO v_client_id, v_tenant_id, v_client_name
  FROM public.patient_profiles pp
  JOIN public.clients c ON c.id = pp.client_id
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado a nenhuma clínica';
  END IF;

  INSERT INTO public.patient_messages (
    tenant_id,
    client_id,
    sender_type,
    sender_user_id,
    sender_name,
    content
  ) VALUES (
    v_tenant_id,
    v_client_id,
    'patient',
    v_patient_user_id,
    v_client_name,
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
  v_client_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paciente não vinculado';
  END IF;

  -- Marcar mensagens da clínica como lidas
  UPDATE public.patient_messages pm
  SET read_at = now()
  WHERE pm.client_id = v_client_id
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
  WHERE pm.client_id = v_client_id
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
  v_client_id uuid;
  v_count integer;
BEGIN
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.patient_messages pm
  WHERE pm.client_id = v_client_id
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
  v_client_tenant_id uuid;
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

  SELECT c.tenant_id INTO v_client_tenant_id
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_client_tenant_id IS NULL OR v_client_tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  INSERT INTO public.patient_messages (
    tenant_id,
    client_id,
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
  client_id uuid,
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
    SELECT DISTINCT ON (pm.client_id)
      pm.client_id,
      pm.content as last_message,
      pm.created_at as last_message_at,
      pm.sender_type as last_sender_type
    FROM public.patient_messages pm
    WHERE pm.tenant_id = v_tenant_id
    ORDER BY pm.client_id, pm.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      pm.client_id,
      COUNT(*) as unread_count
    FROM public.patient_messages pm
    WHERE pm.tenant_id = v_tenant_id
      AND pm.sender_type = 'patient'
      AND pm.read_at IS NULL
    GROUP BY pm.client_id
  )
  SELECT 
    c.id as client_id,
    c.name as client_name,
    lm.last_message,
    lm.last_message_at,
    lm.last_sender_type,
    COALESCE(uc.unread_count, 0) as unread_count
  FROM public.clients c
  JOIN last_messages lm ON lm.client_id = c.id
  LEFT JOIN unread_counts uc ON uc.client_id = c.id
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
  v_client_tenant_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT p.tenant_id INTO v_tenant_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT c.tenant_id INTO v_client_tenant_id
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_client_tenant_id IS NULL OR v_client_tenant_id != v_tenant_id THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;

  -- Marcar mensagens do paciente como lidas
  UPDATE public.patient_messages pm
  SET read_at = now()
  WHERE pm.client_id = p_client_id
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
  WHERE pm.client_id = p_client_id
  ORDER BY pm.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_messages_for_patient(uuid, integer) TO authenticated;

-- 9) Seed de templates de mensagem
INSERT INTO public.message_templates (tenant_id, title, content, category)
SELECT 
  t.id,
  template.title,
  template.content,
  template.category
FROM public.tenants t
CROSS JOIN (VALUES
  ('Confirmação de Agendamento', 'Olá! Confirmamos seu agendamento. Aguardamos você na data e horário marcados. Qualquer dúvida, estamos à disposição.', 'agendamento'),
  ('Resultado Disponível', 'Olá! Informamos que o resultado do seu exame já está disponível no portal. Acesse para visualizar e baixar.', 'exames'),
  ('Lembrete de Consulta', 'Olá! Lembramos que você tem uma consulta agendada. Não se esqueça de trazer seus documentos e exames anteriores.', 'agendamento'),
  ('Receita Disponível', 'Olá! Sua receita médica já está disponível no portal. Acesse para visualizar e baixar.', 'documentos'),
  ('Agradecimento', 'Obrigado por escolher nossa clínica! Esperamos que tenha tido uma boa experiência. Qualquer dúvida, estamos à disposição.', 'geral')
) AS template(title, content, category)
ON CONFLICT DO NOTHING;
