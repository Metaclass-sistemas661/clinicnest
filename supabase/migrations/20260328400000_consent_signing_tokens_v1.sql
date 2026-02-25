-- =====================================================
-- Sistema de Links para Assinatura de Termos via WhatsApp
-- Permite enviar link direto para paciente assinar termos
-- sem precisar de login no portal
-- =====================================================

-- 1) Tabela de tokens de assinatura
CREATE TABLE IF NOT EXISTS public.consent_signing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  template_ids UUID[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT token_not_empty CHECK (token <> ''),
  CONSTRAINT template_ids_not_empty CHECK (array_length(template_ids, 1) > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_token ON public.consent_signing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_client ON public.consent_signing_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_tenant ON public.consent_signing_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consent_signing_tokens_expires ON public.consent_signing_tokens(expires_at) WHERE used_at IS NULL;

-- RLS
ALTER TABLE public.consent_signing_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view tokens"
ON public.consent_signing_tokens FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can create tokens"
ON public.consent_signing_tokens FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can delete tokens"
ON public.consent_signing_tokens FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 2) Função para gerar token seguro
CREATE OR REPLACE FUNCTION public.generate_consent_signing_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Gera token de 32 caracteres alfanuméricos
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');
    v_token := substring(v_token from 1 for 32);
    
    SELECT EXISTS(SELECT 1 FROM public.consent_signing_tokens WHERE token = v_token) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_token;
END;
$$;

-- 3) RPC para criar link de assinatura
CREATE OR REPLACE FUNCTION public.create_consent_signing_link(
  p_client_id UUID,
  p_template_ids UUID[] DEFAULT NULL,
  p_expires_hours INT DEFAULT 72
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_token TEXT;
  v_template_ids UUID[];
  v_client_name TEXT;
  v_token_id UUID;
BEGIN
  -- Obter tenant do usuário
  SELECT get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  END IF;
  
  -- Verificar se cliente pertence ao tenant
  SELECT name INTO v_client_name
  FROM public.clients
  WHERE id = p_client_id AND tenant_id = v_tenant_id;
  
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado';
  END IF;
  
  -- Se não especificou templates, pegar todos os ativos obrigatórios
  IF p_template_ids IS NULL OR array_length(p_template_ids, 1) IS NULL THEN
    SELECT array_agg(id) INTO v_template_ids
    FROM public.consent_templates
    WHERE tenant_id = v_tenant_id
      AND is_active = true
      AND is_required = true;
  ELSE
    v_template_ids := p_template_ids;
  END IF;
  
  -- Verificar se há templates
  IF v_template_ids IS NULL OR array_length(v_template_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum termo disponível para assinatura';
  END IF;
  
  -- Gerar token
  v_token := generate_consent_signing_token();
  
  -- Criar registro
  INSERT INTO public.consent_signing_tokens (
    tenant_id,
    client_id,
    token,
    template_ids,
    expires_at,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_client_id,
    v_token,
    v_template_ids,
    now() + (p_expires_hours || ' hours')::interval,
    auth.uid()
  )
  RETURNING id INTO v_token_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'token_id', v_token_id,
    'client_name', v_client_name,
    'template_count', array_length(v_template_ids, 1),
    'expires_at', now() + (p_expires_hours || ' hours')::interval
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_consent_signing_link(UUID, UUID[], INT) TO authenticated;

-- 4) RPC pública para validar token e obter dados (sem autenticação)
CREATE OR REPLACE FUNCTION public.validate_consent_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_client RECORD;
  v_tenant RECORD;
  v_templates JSONB;
  v_pending_templates JSONB;
BEGIN
  -- Buscar token
  SELECT * INTO v_token_record
  FROM public.consent_signing_tokens
  WHERE token = p_token;
  
  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token inválido ou não encontrado');
  END IF;
  
  -- Verificar expiração
  IF v_token_record.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Link expirado. Solicite um novo link à clínica.');
  END IF;
  
  -- Verificar se já foi usado
  IF v_token_record.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este link já foi utilizado.');
  END IF;
  
  -- Buscar dados do cliente
  SELECT id, name, email, phone, cpf, date_of_birth, birth_date,
         street, street_number, neighborhood, city, state, zip_code,
         address_street, address_city, address_state, address_zip
  INTO v_client
  FROM public.clients
  WHERE id = v_token_record.client_id;
  
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Paciente não encontrado');
  END IF;
  
  -- Buscar dados do tenant
  SELECT name, cnpj, address, responsible_doctor, responsible_crm
  INTO v_tenant
  FROM public.tenants
  WHERE id = v_token_record.tenant_id;
  
  -- Buscar templates que ainda não foram assinados
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ct.id,
      'title', ct.title,
      'slug', ct.slug,
      'body_html', ct.body_html,
      'is_required', ct.is_required,
      'template_type', ct.template_type,
      'pdf_storage_path', ct.pdf_storage_path
    )
  ) INTO v_pending_templates
  FROM public.consent_templates ct
  WHERE ct.id = ANY(v_token_record.template_ids)
    AND ct.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.client_id = v_token_record.client_id
        AND pc.template_id = ct.id
    );
  
  -- Se todos já foram assinados
  IF v_pending_templates IS NULL OR jsonb_array_length(v_pending_templates) = 0 THEN
    -- Marcar token como usado
    UPDATE public.consent_signing_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;
    
    RETURN jsonb_build_object(
      'valid', true,
      'all_signed', true,
      'client_name', v_client.name,
      'clinic_name', v_tenant.name
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'all_signed', false,
    'token_id', v_token_record.id,
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'email', v_client.email,
      'phone', v_client.phone,
      'cpf', v_client.cpf,
      'date_of_birth', COALESCE(v_client.date_of_birth, v_client.birth_date),
      'address', COALESCE(
        v_client.street || COALESCE(', ' || v_client.street_number, '') || 
        COALESCE(' - ' || v_client.neighborhood, '') || 
        COALESCE(' - ' || v_client.city, '') || 
        COALESCE('/' || v_client.state, ''),
        v_client.address_street || COALESCE(' - ' || v_client.address_city, '') || 
        COALESCE('/' || v_client.address_state, '')
      )
    ),
    'tenant', jsonb_build_object(
      'name', v_tenant.name,
      'cnpj', v_tenant.cnpj,
      'address', v_tenant.address,
      'responsible_doctor', v_tenant.responsible_doctor,
      'responsible_crm', v_tenant.responsible_crm
    ),
    'templates', v_pending_templates
  );
END;
$$;

-- Permitir acesso anônimo para validação de token
GRANT EXECUTE ON FUNCTION public.validate_consent_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_consent_token(TEXT) TO authenticated;

-- 5) RPC pública para assinar termo via token (sem autenticação)
CREATE OR REPLACE FUNCTION public.sign_consent_via_token(
  p_token TEXT,
  p_template_id UUID,
  p_facial_photo_path TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_template RECORD;
  v_consent_id UUID;
  v_remaining INT;
BEGIN
  -- Buscar e validar token
  SELECT * INTO v_token_record
  FROM public.consent_signing_tokens
  WHERE token = p_token
    AND expires_at > now()
    AND used_at IS NULL;
  
  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido, expirado ou já utilizado');
  END IF;
  
  -- Verificar se template está na lista permitida
  IF NOT (p_template_id = ANY(v_token_record.template_ids)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Termo não autorizado para este link');
  END IF;
  
  -- Buscar template
  SELECT * INTO v_template
  FROM public.consent_templates
  WHERE id = p_template_id
    AND tenant_id = v_token_record.tenant_id
    AND is_active = true;
  
  IF v_template IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Termo não encontrado ou inativo');
  END IF;
  
  -- Verificar se já foi assinado
  IF EXISTS (
    SELECT 1 FROM public.patient_consents
    WHERE client_id = v_token_record.client_id
      AND template_id = p_template_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este termo já foi assinado');
  END IF;
  
  -- Criar assinatura
  INSERT INTO public.patient_consents (
    tenant_id,
    client_id,
    template_id,
    signed_at,
    ip_address,
    user_agent,
    facial_photo_path,
    template_snapshot_html
  )
  VALUES (
    v_token_record.tenant_id,
    v_token_record.client_id,
    p_template_id,
    now(),
    p_ip_address,
    p_user_agent,
    p_facial_photo_path,
    v_template.body_html
  )
  RETURNING id INTO v_consent_id;
  
  -- Contar quantos termos ainda faltam
  SELECT COUNT(*) INTO v_remaining
  FROM public.consent_templates ct
  WHERE ct.id = ANY(v_token_record.template_ids)
    AND ct.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.client_id = v_token_record.client_id
        AND pc.template_id = ct.id
    );
  
  -- Se todos foram assinados, marcar token como usado
  IF v_remaining = 0 THEN
    UPDATE public.consent_signing_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'remaining', v_remaining,
    'all_done', v_remaining = 0
  );
END;
$$;

-- Permitir acesso anônimo para assinatura
GRANT EXECUTE ON FUNCTION public.sign_consent_via_token(TEXT, UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.sign_consent_via_token(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 6) Política para permitir upload de fotos via token (anônimo)
-- O bucket consent-photos precisa permitir uploads anônimos para o fluxo de assinatura via link
CREATE POLICY "Anyone can upload consent photos with valid path"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'consent-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
);

-- 7) Comentários
COMMENT ON TABLE public.consent_signing_tokens IS 'Tokens para assinatura de termos via link (WhatsApp/Email)';
COMMENT ON FUNCTION public.create_consent_signing_link IS 'Cria link de assinatura para enviar ao paciente';
COMMENT ON FUNCTION public.validate_consent_token IS 'Valida token e retorna dados para assinatura (público)';
COMMENT ON FUNCTION public.sign_consent_via_token IS 'Registra assinatura de termo via token (público)';
