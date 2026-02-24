-- =====================================================
-- Suporte a Upload de PDF para Termos de Consentimento
-- Permite que clínicas façam upload de seus próprios PDFs
-- Sistema híbrido: modelos pré-montados + PDFs customizados
-- =====================================================

-- 1) Adicionar colunas para suporte a PDF na tabela consent_templates
ALTER TABLE public.consent_templates
ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'html'
  CHECK (template_type IN ('html', 'pdf'));

ALTER TABLE public.consent_templates
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

ALTER TABLE public.consent_templates
ADD COLUMN IF NOT EXISTS pdf_original_filename TEXT;

ALTER TABLE public.consent_templates
ADD COLUMN IF NOT EXISTS pdf_file_size INTEGER;

-- Comentários explicativos
COMMENT ON COLUMN public.consent_templates.template_type IS 'Tipo do template: html (editor visual) ou pdf (upload)';
COMMENT ON COLUMN public.consent_templates.pdf_storage_path IS 'Caminho do PDF no Supabase Storage';
COMMENT ON COLUMN public.consent_templates.pdf_original_filename IS 'Nome original do arquivo PDF';
COMMENT ON COLUMN public.consent_templates.pdf_file_size IS 'Tamanho do arquivo em bytes';

-- 2) Criar bucket para armazenar PDFs de termos (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consent-pdfs',
  'consent-pdfs',
  false,
  10485760, -- 10MB max
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3) Políticas de storage para o bucket consent-pdfs
-- Admins podem fazer upload
CREATE POLICY "Admins can upload consent PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'consent-pdfs'
  AND public.is_tenant_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Admins podem atualizar
CREATE POLICY "Admins can update consent PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'consent-pdfs'
  AND public.is_tenant_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Admins podem deletar
CREATE POLICY "Admins can delete consent PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'consent-pdfs'
  AND public.is_tenant_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Membros do tenant podem ler (para gerar documentos)
CREATE POLICY "Tenant members can read consent PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'consent-pdfs'
  AND (storage.foldername(name))[1]::uuid = public.get_user_tenant_id(auth.uid())
);

-- 4) Atualizar RPC de upsert para suportar PDF
CREATE OR REPLACE FUNCTION public.upsert_consent_template(
  p_title TEXT,
  p_slug TEXT,
  p_body_html TEXT,
  p_is_required BOOLEAN,
  p_is_active BOOLEAN,
  p_sort_order INT,
  p_template_id UUID DEFAULT NULL,
  p_template_type TEXT DEFAULT 'html',
  p_pdf_storage_path TEXT DEFAULT NULL,
  p_pdf_original_filename TEXT DEFAULT NULL,
  p_pdf_file_size INTEGER DEFAULT NULL
)
RETURNS public.consent_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_template public.consent_templates%rowtype;
BEGIN
  -- Obter tenant do usuário
  SELECT get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhum tenant';
  END IF;

  -- Verificar se é admin
  IF NOT is_tenant_admin(auth.uid(), v_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar termos';
  END IF;

  -- Validar tipo
  IF p_template_type NOT IN ('html', 'pdf') THEN
    RAISE EXCEPTION 'Tipo de template inválido: %', p_template_type;
  END IF;

  -- Se for PDF, precisa ter o path
  IF p_template_type = 'pdf' AND p_pdf_storage_path IS NULL THEN
    RAISE EXCEPTION 'PDF storage path é obrigatório para templates do tipo PDF';
  END IF;

  IF p_template_id IS NOT NULL THEN
    -- Update existente
    UPDATE public.consent_templates
    SET 
      title = p_title,
      slug = p_slug,
      body_html = p_body_html,
      is_required = p_is_required,
      is_active = p_is_active,
      sort_order = p_sort_order,
      template_type = p_template_type,
      pdf_storage_path = p_pdf_storage_path,
      pdf_original_filename = p_pdf_original_filename,
      pdf_file_size = p_pdf_file_size,
      updated_at = now()
    WHERE id = p_template_id AND tenant_id = v_tenant_id
    RETURNING * INTO v_template;
    
    IF v_template.id IS NULL THEN
      RAISE EXCEPTION 'Template não encontrado ou sem permissão';
    END IF;
  ELSE
    -- Insert novo
    INSERT INTO public.consent_templates (
      tenant_id, title, slug, body_html, is_required, is_active, sort_order,
      template_type, pdf_storage_path, pdf_original_filename, pdf_file_size
    )
    VALUES (
      v_tenant_id, p_title, p_slug, p_body_html, p_is_required, p_is_active, p_sort_order,
      p_template_type, p_pdf_storage_path, p_pdf_original_filename, p_pdf_file_size
    )
    RETURNING * INTO v_template;
  END IF;

  RETURN v_template;
END;
$$;

-- 5) Índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_consent_templates_type 
ON public.consent_templates(tenant_id, template_type);
