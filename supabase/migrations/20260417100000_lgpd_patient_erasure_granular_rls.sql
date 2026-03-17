-- ============================================================================
-- FASE 7 — Data Privacy e Portabilidade: Erasure + Granular RLS
-- Migration: 20260417100000
--
-- Parte 1: lgpd_erase_patient_data() — Exclusão/anonimização de paciente
--   - Deleção física: logs de navegação, notificações push, access_codes
--   - Anonimização irreversível: dados pessoais (PII) substituídos por hash
--   - Preservação: dados clínicos essenciais 20 anos (CFM 1821/07), financeiros
--   - Token de confirmação: ERASE_PATIENT:<patient_id>
--   - Auditoria completa via log_tenant_action
--
-- Parte 2: has_treated_patient() helper + Granular RLS
--   - Profissionais não-admin veem apenas prontuários de pacientes atendidos
--   - Admin mantém visão global no tenant
--   - Índice de performance em appointments(professional_id, patient_id)
-- ============================================================================

-- ============================================================================
-- PARTE 1 — LGPD: Exclusão de Dados de Paciente (Art. 18, V)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lgpd_erase_patient_data(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_confirmation_token TEXT,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID := auth.uid();
  v_expected_token TEXT;
  v_patient_exists BOOLEAN;
  v_patient_name TEXT;
  v_anonymized_name TEXT;

  -- Contadores
  v_audit_deleted INTEGER := 0;
  v_notifications_deleted INTEGER := 0;
  v_patient_updated INTEGER := 0;
  v_records_anonymized INTEGER := 0;
  v_prescriptions_anonymized INTEGER := 0;
  v_certificates_anonymized INTEGER := 0;
  v_exams_anonymized INTEGER := 0;
  v_referrals_anonymized INTEGER := 0;
  v_evolutions_anonymized INTEGER := 0;
  v_appointments_anonymized INTEGER := 0;
  v_request_updated INTEGER := 0;
BEGIN
  -- ── 1. Validação de segurança ──
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_tenant_admin(v_requester, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar exclusão de dados de paciente';
  END IF;

  -- Verificar se paciente existe no tenant
  SELECT EXISTS(
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND tenant_id = p_tenant_id
  ), (
    SELECT name FROM public.patients
    WHERE id = p_patient_id AND tenant_id = p_tenant_id
  )
  INTO v_patient_exists, v_patient_name;

  IF NOT v_patient_exists THEN
    RAISE EXCEPTION 'Paciente não encontrado neste tenant';
  END IF;

  -- ── 2. Confirmação por token (proteção contra chamada acidental) ──
  v_expected_token := 'ERASE_PATIENT:' || p_patient_id::text;
  IF COALESCE(p_confirmation_token, '') <> v_expected_token THEN
    RAISE EXCEPTION 'Token de confirmação inválido. Esperado: ERASE_PATIENT:<patient_id>';
  END IF;

  -- ── 3. Hash irreversível para pseudonimização ──
  v_anonymized_name := 'PACIENTE ANONIMIZADO #' || left(encode(digest(p_patient_id::text || now()::text, 'sha256'), 'hex'), 8);

  -- ════════════════════════════════════════════════════════════════════════
  -- DELEÇÃO FÍSICA (dados sem obrigação legal de retenção)
  -- ════════════════════════════════════════════════════════════════════════

  -- 3a. Audit logs de navegação/acesso (não exigidos por CFM)
  DELETE FROM public.audit_logs
  WHERE tenant_id = p_tenant_id
    AND entity_type = 'patients'
    AND entity_id = p_patient_id::text;
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

  -- 3b. Notificações push/in-app do paciente (se houver user_id vinculado)
  DELETE FROM public.notifications
  WHERE tenant_id = p_tenant_id
    AND metadata->>'patient_id' = p_patient_id::text;
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

  -- ════════════════════════════════════════════════════════════════════════
  -- ANONIMIZAÇÃO (dados clínicos retidos 20 anos — CFM 1821/07)
  -- Eliminação de PII; estrutura clínica preservada.
  -- ════════════════════════════════════════════════════════════════════════

  -- 4. Paciente: substituir PII, manter tenant_id e id para integridade relacional
  UPDATE public.patients
  SET
    name = v_anonymized_name,
    email = NULL,
    phone = NULL,
    cpf = NULL,
    access_code = NULL,
    street = NULL,
    street_number = NULL,
    complement = NULL,
    neighborhood = NULL,
    city = NULL,
    state = NULL,
    zip_code = NULL,
    allergies = NULL,
    notes = NULL,
    insurance_card_number = NULL,
    -- Manter: date_of_birth (apenas ano, para estatísticas etárias)
    date_of_birth = CASE
      WHEN date_of_birth IS NOT NULL
      THEN make_date(extract(year FROM date_of_birth)::int, 1, 1)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_patient_id
    AND tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_patient_updated = ROW_COUNT;

  -- 5. Prontuários: limpar texto livre que possa conter nomes/contextos pessoais
  --    Preservar: diagnóstico, CID, plano terapêutico (valor clínico-científico)
  UPDATE public.medical_records
  SET
    chief_complaint = '** ANONIMIZADO **',
    anamnesis = NULL,
    physical_exam = NULL,
    notes = NULL,
    -- Manter: diagnosis, cid_code, treatment_plan, prescriptions (campo legado JSON)
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_records_anonymized = ROW_COUNT;

  -- 6. Prescrições: manter medicações (dados clínicos), limpar instruções pessoais
  UPDATE public.prescriptions
  SET
    instructions = NULL,
    -- Manter: medications, prescription_type, status, digital_signature
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_prescriptions_anonymized = ROW_COUNT;

  -- 7. Atestados: anonimizar conteúdo textual
  UPDATE public.medical_certificates
  SET
    content = '** CONTEÚDO ANONIMIZADO **',
    -- Manter: certificate_type, cid_code, days_off
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_certificates_anonymized = ROW_COUNT;

  -- 8. Exames: anonimizar resultado textual, manter tipo e status
  UPDATE public.exam_results
  SET
    result_text = '** ANONIMIZADO **',
    interpretation = NULL,
    -- Manter: exam_type, exam_name, status, lab_name
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_exams_anonymized = ROW_COUNT;

  -- 9. Encaminhamentos: anonimizar resumo clínico
  UPDATE public.referrals
  SET
    clinical_summary = NULL,
    reason = '** ANONIMIZADO **',
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_referrals_anonymized = ROW_COUNT;

  -- 10. Evoluções clínicas: anonimizar SOAP + notas
  UPDATE public.clinical_evolutions
  SET
    subjective = '** ANONIMIZADO **',
    objective = NULL,
    assessment = NULL,
    plan = NULL,
    notes = NULL,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_evolutions_anonymized = ROW_COUNT;

  -- 11. Agendamentos: limpar notas textuais
  UPDATE public.appointments
  SET
    notes = NULL,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND patient_id = p_patient_id;
  GET DIAGNOSTICS v_appointments_anonymized = ROW_COUNT;

  -- ════════════════════════════════════════════════════════════════════════
  -- AUDITORIA E TRACKING
  -- ════════════════════════════════════════════════════════════════════════

  -- 12. Marcar lgpd_data_request como concluída (se fornecida)
  IF p_request_id IS NOT NULL THEN
    UPDATE public.lgpd_data_requests
    SET
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    WHERE id = p_request_id
      AND tenant_id = p_tenant_id;
    GET DIAGNOSTICS v_request_updated = ROW_COUNT;
  END IF;

  -- 13. Log de auditoria com resumo completo (este log NÃO contém PII)
  PERFORM public.log_tenant_action(
    p_tenant_id,
    v_requester,
    'lgpd_patient_data_erasure',
    'patients',
    p_patient_id::text,
    jsonb_build_object(
      'anonymized_name', v_anonymized_name,
      'audit_logs_deleted', v_audit_deleted,
      'notifications_deleted', v_notifications_deleted,
      'patient_record_anonymized', v_patient_updated,
      'medical_records_anonymized', v_records_anonymized,
      'prescriptions_anonymized', v_prescriptions_anonymized,
      'certificates_anonymized', v_certificates_anonymized,
      'exams_anonymized', v_exams_anonymized,
      'referrals_anonymized', v_referrals_anonymized,
      'evolutions_anonymized', v_evolutions_anonymized,
      'appointments_anonymized', v_appointments_anonymized,
      'lgpd_request_updated', v_request_updated,
      'executed_at', now()::text,
      'confirmation_token_valid', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', p_patient_id,
    'anonymized_name', v_anonymized_name,
    'summary', jsonb_build_object(
      'physical_deletions', jsonb_build_object(
        'audit_logs', v_audit_deleted,
        'notifications', v_notifications_deleted
      ),
      'anonymizations', jsonb_build_object(
        'patient_record', v_patient_updated,
        'medical_records', v_records_anonymized,
        'prescriptions', v_prescriptions_anonymized,
        'certificates', v_certificates_anonymized,
        'exams', v_exams_anonymized,
        'referrals', v_referrals_anonymized,
        'evolutions', v_evolutions_anonymized,
        'appointments', v_appointments_anonymized
      ),
      'lgpd_request_marked_completed', v_request_updated
    ),
    'executed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lgpd_erase_patient_data(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lgpd_erase_patient_data(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lgpd_erase_patient_data(UUID, UUID, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.lgpd_erase_patient_data IS
  'LGPD Art. 18, V — Exclusão/anonimização irreversível de dados de paciente. '
  'Deleção física de logs e notificações. Anonimização de PII em registros clínicos '
  'com retenção de 20 anos (CFM 1821/07). Requer admin + token ERASE_PATIENT:<id>.';


-- ============================================================================
-- PREVIEW de exclusão (dry-run seguro para UI de confirmação)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preview_lgpd_patient_erasure(
  p_tenant_id UUID,
  p_patient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID := auth.uid();
  v_patient_name TEXT;
  v_counts JSONB;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_tenant_admin(v_requester, p_tenant_id) THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar prévia de exclusão';
  END IF;

  SELECT name INTO v_patient_name
  FROM public.patients
  WHERE id = p_patient_id AND tenant_id = p_tenant_id;

  IF v_patient_name IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado neste tenant';
  END IF;

  SELECT jsonb_build_object(
    'patient_name', v_patient_name,
    'patient_id', p_patient_id,
    'confirmation_token', 'ERASE_PATIENT:' || p_patient_id::text,
    'will_delete', jsonb_build_object(
      'audit_logs', (SELECT count(*) FROM public.audit_logs WHERE tenant_id = p_tenant_id AND entity_type = 'patients' AND entity_id = p_patient_id::text),
      'notifications', (SELECT count(*) FROM public.notifications WHERE tenant_id = p_tenant_id AND metadata->>'patient_id' = p_patient_id::text)
    ),
    'will_anonymize', jsonb_build_object(
      'patient_record', 1,
      'medical_records', (SELECT count(*) FROM public.medical_records WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'prescriptions', (SELECT count(*) FROM public.prescriptions WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'certificates', (SELECT count(*) FROM public.medical_certificates WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'exams', (SELECT count(*) FROM public.exam_results WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'referrals', (SELECT count(*) FROM public.referrals WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'evolutions', (SELECT count(*) FROM public.clinical_evolutions WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),
      'appointments', (SELECT count(*) FROM public.appointments WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id)
    ),
    'warning', 'Esta ação é IRREVERSÍVEL. Dados pessoais serão permanentemente removidos. Dados clínicos serão anonimizados conforme CFM 1821/07.'
  ) INTO v_counts;

  RETURN v_counts;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_lgpd_patient_erasure(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_lgpd_patient_erasure(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_lgpd_patient_erasure(UUID, UUID) TO service_role;


-- ============================================================================
-- PARTE 2 — RLS Granular: Profissionais veem apenas pacientes atendidos
-- ============================================================================

-- ── Helper: has_treated_patient ──────────────────────────────────────────────
-- Verifica se o profissional (via auth.uid() → profiles.user_id) tem no mínimo
-- 1 agendamento (qualquer status exceto 'cancelled') com o paciente.
-- SECURITY DEFINER para evitar recursão RLS em appointments.

CREATE OR REPLACE FUNCTION public.has_treated_patient(p_user_id UUID, p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.profiles p ON p.id = a.professional_id
    WHERE p.user_id = p_user_id
      AND a.patient_id = p_patient_id
      AND a.status <> 'cancelled'
  );
$$;

REVOKE ALL ON FUNCTION public.has_treated_patient(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_treated_patient(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_treated_patient(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.has_treated_patient IS
  'Retorna TRUE se o usuário (via user_id) possui ao menos 1 agendamento não-cancelado '
  'com o paciente. Usada em RLS para restringir acesso clínico a pacientes atendidos.';

-- ── Índice de performance para a junção appointments × profiles ──────────────
CREATE INDEX IF NOT EXISTS idx_appointments_professional_patient
  ON public.appointments (professional_id, patient_id)
  WHERE status <> 'cancelled';


-- ════════════════════════════════════════════════════════════════════════════
-- 2A. medical_records: SELECT restrito a pacientes atendidos
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "medical_records_select" ON public.medical_records;
CREATE POLICY "medical_records_select" ON public.medical_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- INSERT: manter clínicos (sem restrição por paciente — precisa registrar primeiro atendimento)
DROP POLICY IF EXISTS "medical_records_insert" ON public.medical_records;
CREATE POLICY "medical_records_insert" ON public.medical_records
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- UPDATE: profissional só edita registros de pacientes que atendeu
DROP POLICY IF EXISTS "medical_records_update" ON public.medical_records;
CREATE POLICY "medical_records_update" ON public.medical_records
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 2B. prescriptions: SELECT restrito a pacientes atendidos
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "prescriptions_select" ON public.prescriptions;
CREATE POLICY "prescriptions_select" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

-- INSERT: manter prescritores (sem restrição por paciente — mesma razão do prontuário)
DROP POLICY IF EXISTS "prescriptions_insert" ON public.prescriptions;
CREATE POLICY "prescriptions_insert" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_prescriber(auth.uid())
    )
  );

-- UPDATE: prescritor + tratou o paciente
DROP POLICY IF EXISTS "prescriptions_update" ON public.prescriptions;
CREATE POLICY "prescriptions_update" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 2C. medical_certificates: SELECT restrito a pacientes atendidos
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "medical_certificates_select" ON public.medical_certificates;
CREATE POLICY "medical_certificates_select" ON public.medical_certificates
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

DROP POLICY IF EXISTS "medical_certificates_insert" ON public.medical_certificates;
CREATE POLICY "medical_certificates_insert" ON public.medical_certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_prescriber(auth.uid())
    )
  );

DROP POLICY IF EXISTS "medical_certificates_update" ON public.medical_certificates;
CREATE POLICY "medical_certificates_update" ON public.medical_certificates
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_prescriber(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 2D. exam_results: SELECT restrito a pacientes atendidos
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "exam_results_select" ON public.exam_results;
CREATE POLICY "exam_results_select" ON public.exam_results
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 2E. referrals: SELECT restrito a pacientes atendidos
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "referrals_select" ON public.referrals;
CREATE POLICY "referrals_select" ON public.referrals
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

DROP POLICY IF EXISTS "referrals_insert" ON public.referrals;
CREATE POLICY "referrals_insert" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

DROP POLICY IF EXISTS "referrals_update" ON public.referrals;
CREATE POLICY "referrals_update" ON public.referrals
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 2F. clinical_evolutions: SELECT restrito a pacientes atendidos
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "clinical_evolutions_select" ON public.clinical_evolutions;
CREATE POLICY "clinical_evolutions_select" ON public.clinical_evolutions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );

DROP POLICY IF EXISTS "clinical_evolutions_insert" ON public.clinical_evolutions;
CREATE POLICY "clinical_evolutions_insert" ON public.clinical_evolutions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

DROP POLICY IF EXISTS "clinical_evolutions_update" ON public.clinical_evolutions;
CREATE POLICY "clinical_evolutions_update" ON public.clinical_evolutions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        public.is_clinical_professional(auth.uid())
        AND public.has_treated_patient(auth.uid(), patient_id)
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- Fim da migration
-- ════════════════════════════════════════════════════════════════════════════
