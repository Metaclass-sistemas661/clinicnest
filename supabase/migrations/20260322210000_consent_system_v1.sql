-- =====================================================
-- Sistema de Termos e Consentimentos do Paciente
-- Termos de uso de imagem, desconfortos pós-procedimento, contrato
-- Assinatura digital com captura facial via webcam
-- =====================================================

-- 1) Tabela de templates de termos (gerenciados pela clínica)
CREATE TABLE IF NOT EXISTS public.consent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,                          -- Ex: "Termo de Uso de Imagem"
    slug TEXT NOT NULL,                           -- Ex: "uso_imagem", "desconfortos", "contrato"
    body_html TEXT NOT NULL DEFAULT '',            -- Conteúdo HTML do termo
    is_required BOOLEAN NOT NULL DEFAULT true,    -- Obrigatório para liberar portal
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read consent templates"
  ON public.consent_templates FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage consent templates"
  ON public.consent_templates FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- 2) Tabela de aceites do paciente (assinaturas digitais)
CREATE TABLE IF NOT EXISTS public.patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.consent_templates(id) ON DELETE CASCADE,
    patient_user_id UUID NOT NULL,                -- auth.uid() do paciente
    signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT,
    facial_photo_path TEXT,                       -- Caminho no storage bucket
    template_snapshot_html TEXT,                   -- Snapshot do termo no momento da assinatura
    UNIQUE(client_id, template_id)                -- Um aceite por termo por paciente
);

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

-- Paciente pode ver seus próprios aceites
CREATE POLICY "Patients can read own consents"
  ON public.patient_consents FOR SELECT
  TO authenticated
  USING (patient_user_id = auth.uid());

-- Paciente pode inserir seus próprios aceites
CREATE POLICY "Patients can sign consents"
  ON public.patient_consents FOR INSERT
  TO authenticated
  WITH CHECK (patient_user_id = auth.uid());

-- Staff da clínica pode ver aceites do tenant
CREATE POLICY "Tenant staff can read patient consents"
  ON public.patient_consents FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 3) Storage bucket para fotos faciais das assinaturas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consent-photos',
  'consent-photos',
  false,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Paciente pode fazer upload da própria foto facial
CREATE POLICY "Patients can upload consent photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'consent-photos');

-- Paciente pode ler suas próprias fotos
CREATE POLICY "Patients can read own consent photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-photos'
  );

-- Staff pode ler fotos de consentimento
CREATE POLICY "Staff can read consent photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-photos'
  );

-- 4) RPC: Listar termos pendentes para o paciente logado
CREATE OR REPLACE FUNCTION public.get_pending_consents(p_client_id uuid)
RETURNS SETOF public.consent_templates
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ct.*
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
  WHERE c.id = p_client_id
    AND ct.is_active = true
    AND ct.is_required = true
    AND NOT EXISTS (
      SELECT 1 FROM public.patient_consents pc
      WHERE pc.client_id = p_client_id
        AND pc.template_id = ct.id
    )
  ORDER BY ct.sort_order, ct.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_consents(uuid) TO authenticated;

-- 5) RPC: Registrar assinatura de termo com foto facial
CREATE OR REPLACE FUNCTION public.sign_consent(
  p_client_id uuid,
  p_template_id uuid,
  p_facial_photo_path text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_template public.consent_templates%rowtype;
  v_consent_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  -- Verificar que o template existe e pertence ao tenant do paciente
  SELECT ct.* INTO v_template
  FROM public.consent_templates ct
  JOIN public.clients c ON c.tenant_id = ct.tenant_id
  WHERE ct.id = p_template_id
    AND c.id = p_client_id
    AND ct.is_active = true;

  IF NOT FOUND THEN
    PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
  END IF;

  -- Verificar se já foi assinado
  IF EXISTS (
    SELECT 1 FROM public.patient_consents pc
    WHERE pc.client_id = p_client_id AND pc.template_id = p_template_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Termo já assinado anteriormente');
  END IF;

  -- Inserir aceite
  INSERT INTO public.patient_consents (
    tenant_id, client_id, template_id, patient_user_id,
    facial_photo_path, ip_address, user_agent,
    template_snapshot_html
  )
  VALUES (
    v_template.tenant_id, p_client_id, p_template_id, v_user_id,
    p_facial_photo_path, p_ip_address, p_user_agent,
    v_template.body_html
  )
  RETURNING id INTO v_consent_id;

  RETURN jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'template_title', v_template.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_consent(uuid, uuid, text, text, text) TO authenticated;

-- 6) RPC: Admin gerenciar templates de termos
CREATE OR REPLACE FUNCTION public.upsert_consent_template(
  p_title text,
  p_slug text,
  p_body_html text,
  p_is_required boolean DEFAULT true,
  p_is_active boolean DEFAULT true,
  p_sort_order int DEFAULT 0,
  p_template_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    PERFORM public.raise_app_error('UNAUTHENTICATED', 'Usuário não autenticado');
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = v_user_id LIMIT 1;
  IF NOT FOUND OR v_profile.role != 'admin' THEN
    PERFORM public.raise_app_error('FORBIDDEN', 'Apenas administradores podem gerenciar termos');
  END IF;

  IF p_template_id IS NULL THEN
    INSERT INTO public.consent_templates (tenant_id, title, slug, body_html, is_required, is_active, sort_order)
    VALUES (v_profile.tenant_id, p_title, p_slug, p_body_html, p_is_required, p_is_active, p_sort_order)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.consent_templates
    SET title = p_title,
        slug = p_slug,
        body_html = p_body_html,
        is_required = p_is_required,
        is_active = p_is_active,
        sort_order = p_sort_order,
        updated_at = now()
    WHERE id = p_template_id AND tenant_id = v_profile.tenant_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      PERFORM public.raise_app_error('NOT_FOUND', 'Termo não encontrado');
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'template_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_consent_template(text, text, text, boolean, boolean, int, uuid) TO authenticated;

-- 7) Índices
CREATE INDEX IF NOT EXISTS idx_consent_templates_tenant ON public.consent_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_client ON public.patient_consents(client_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_template ON public.patient_consents(template_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_tenant ON public.patient_consents(tenant_id);
