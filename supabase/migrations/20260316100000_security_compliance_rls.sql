-- =====================================================
-- Sprint 1 — Segurança Crítica: RLS de Compliance + Storage + Contact Spam
-- Ref: RELATORIO-FINAL-CLINICNEST.md §5.2, §5.5
-- Data: 2026-03-16
-- =====================================================

BEGIN;

-- =====================================================
-- PARTE 1: RLS para tabelas de compliance sem proteção
-- Severidade: 🔴 CRÍTICO (C2)
-- Tabelas: prontuario_exports, sbis_documentation,
--          ripd_reports, backup_logs
-- Regra: somente admin do tenant pode acessar
-- =====================================================

-- ----- prontuario_exports -----
ALTER TABLE public.prontuario_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuario_exports FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admin_select_prontuario_exports"
  ON public.prontuario_exports FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_insert_prontuario_exports"
  ON public.prontuario_exports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_update_prontuario_exports"
  ON public.prontuario_exports FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_delete_prontuario_exports"
  ON public.prontuario_exports FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- ----- sbis_documentation -----
ALTER TABLE public.sbis_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbis_documentation FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admin_select_sbis_documentation"
  ON public.sbis_documentation FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_insert_sbis_documentation"
  ON public.sbis_documentation FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_update_sbis_documentation"
  ON public.sbis_documentation FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_delete_sbis_documentation"
  ON public.sbis_documentation FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- ----- ripd_reports -----
ALTER TABLE public.ripd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ripd_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admin_select_ripd_reports"
  ON public.ripd_reports FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_insert_ripd_reports"
  ON public.ripd_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_update_ripd_reports"
  ON public.ripd_reports FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_delete_ripd_reports"
  ON public.ripd_reports FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- ----- backup_logs -----
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admin_select_backup_logs"
  ON public.backup_logs FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_insert_backup_logs"
  ON public.backup_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_update_backup_logs"
  ON public.backup_logs FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "tenant_admin_delete_backup_logs"
  ON public.backup_logs FOR DELETE
  TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );


-- =====================================================
-- PARTE 2: Trava de Storage — consent-photos
-- Severidade: 🟠 ALTO (A5)
-- Problema: qualquer authenticated pode ler TODAS as fotos
-- Solução: owner-based filtering via path + tenant staff via join
-- Convenção de path: {patient_user_id}/{consent_id}.jpg
-- =====================================================

-- Remover policies amplas existentes
DROP POLICY IF EXISTS "Patients can upload consent photos"   ON storage.objects;
DROP POLICY IF EXISTS "Patients can read own consent photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read consent photos"        ON storage.objects;

-- Upload: somente autenticado, path deve iniciar com seu próprio user_id
CREATE POLICY "consent_photos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'consent-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Download paciente: somente suas próprias fotos (pasta com seu uid)
CREATE POLICY "consent_photos_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Download staff: pode ler fotos de pacientes do seu tenant
-- Verifica se o user_id da pasta pertence a um patient_consent daquele tenant
CREATE POLICY "consent_photos_select_tenant_staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consent-photos'
    AND EXISTS (
      SELECT 1
      FROM public.patient_consents pc
      WHERE pc.patient_user_id::text = (storage.foldername(name))[1]
        AND pc.tenant_id = public.get_user_tenant_id(auth.uid())
    )
    AND public.get_user_tenant_id(auth.uid()) IS NOT NULL
  );


-- =====================================================
-- PARTE 3: Correção de Spam — contact_messages
-- Severidade: 🟡 MÉDIO (M8)
-- Problema: WITH CHECK (true) permite INSERT irrestrito
-- Solução: validação básica de campos + limite via constraint
-- =====================================================

-- Remover a policy aberta
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_messages;

-- Nova policy: anon pode inserir mas com campos obrigatórios validados
-- A validação real de formato é feita pelas constraints abaixo
CREATE POLICY "anon_can_submit_contact_form_validated"
  ON public.contact_messages
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Campos não vazios (trim whitespace)
    length(trim(name)) >= 2
    AND length(trim(email)) >= 5
    AND length(trim(subject)) >= 3
    AND length(trim(message)) >= 10
    -- Email precisa conter @ e .
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    -- Limite máximo para prevenir payload abuse
    AND length(message) <= 5000
    AND length(name) <= 200
    AND length(subject) <= 300
  );

-- Constraint de rate-limit: impede mais de 5 mensagens do mesmo email em 1 hora
-- Implementado via índice parcial + função de checagem
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

-- Trigger de rate-limit (DROP IF EXISTS para idempotência)
DROP TRIGGER IF EXISTS trg_contact_rate_limit ON public.contact_messages;

CREATE TRIGGER trg_contact_rate_limit
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_contact_rate_limit();

-- Índice para performance do rate-limit check
CREATE INDEX IF NOT EXISTS idx_contact_messages_email_created
  ON public.contact_messages (email, created_at DESC);

COMMIT;
