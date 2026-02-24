-- ============================================================
-- FASE 12C — RLS Reforçada no Banco (Controle de Acessos Granular)
-- Segurança real: mesmo que o frontend falhe, o banco bloqueia.
--
-- Helpers criados na 12A: is_clinical_professional(), is_prescriber()
-- ============================================================

-- ============================================================
-- 12C.1 + 12C.2 — Helpers auxiliares adicionais
-- (is_clinical_professional e is_prescriber já existem em 12A)
-- ============================================================

-- Enfermagem: enfermeiro + tec_enfermagem
CREATE OR REPLACE FUNCTION public.is_nursing_professional(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND professional_type IN ('enfermeiro','tec_enfermagem')
  );
$$;

REVOKE ALL ON FUNCTION public.is_nursing_professional(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_nursing_professional(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_nursing_professional(UUID) TO service_role;

-- Admin ou faturista (para dados financeiros)
CREATE OR REPLACE FUNCTION public.is_admin_or_faturista(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_user_id AND p.professional_type = 'faturista'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_faturista(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_faturista(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_faturista(UUID) TO service_role;

-- ============================================================
-- 12C.3 — RLS em medical_records: restringir SELECT
-- Admin e clínicos podem ver; profissionais não-médicos/dentistas
-- veem apenas seus próprios registros.
-- Secretária e faturista bloqueados.
-- ============================================================

DROP POLICY IF EXISTS "medical_records_select" ON public.medical_records;
CREATE POLICY "medical_records_select" ON public.medical_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- INSERT: apenas profissionais clínicos
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

-- UPDATE: apenas profissionais clínicos (mesmo tenant)
DROP POLICY IF EXISTS "medical_records_update" ON public.medical_records;
CREATE POLICY "medical_records_update" ON public.medical_records
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- DELETE: apenas admin (sem alteração)
-- (política "medical_records_delete" já exige is_tenant_admin — mantemos)

-- ============================================================
-- 12C.4 — RLS em prescriptions (receituários): restringir INSERT
-- SELECT: admin + clínicos
-- INSERT/UPDATE: apenas prescritores (médico, dentista)
-- ============================================================

DROP POLICY IF EXISTS "prescriptions_select" ON public.prescriptions;
CREATE POLICY "prescriptions_select" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

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

DROP POLICY IF EXISTS "prescriptions_update" ON public.prescriptions;
CREATE POLICY "prescriptions_update" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_prescriber(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_prescriber(auth.uid())
    )
  );

-- DELETE: apenas admin (sem alteração)

-- ============================================================
-- 12C.5 — RLS em medical_certificates (atestados): restringir INSERT
-- Mesmo padrão de prescriptions: SELECT admin+clínicos, INSERT prescritores
-- ============================================================

DROP POLICY IF EXISTS "medical_certificates_select" ON public.medical_certificates;
CREATE POLICY "medical_certificates_select" ON public.medical_certificates
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
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
      OR public.is_prescriber(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_prescriber(auth.uid())
    )
  );

-- DELETE: apenas admin (sem alteração)

-- ============================================================
-- 12C.6 — RLS em triage_records: restringir INSERT
-- INSERT: enfermeiro + tec_enfermagem
-- SELECT: admin + todos os clínicos
-- ============================================================

DROP POLICY IF EXISTS "triage_records_select" ON public.triage_records;
CREATE POLICY "triage_records_select" ON public.triage_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

DROP POLICY IF EXISTS "triage_records_insert" ON public.triage_records;
CREATE POLICY "triage_records_insert" ON public.triage_records
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_nursing_professional(auth.uid())
    )
  );

DROP POLICY IF EXISTS "triage_records_update" ON public.triage_records;
CREATE POLICY "triage_records_update" ON public.triage_records
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_nursing_professional(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_nursing_professional(auth.uid())
    )
  );

-- DELETE: apenas admin (sem alteração)

-- ============================================================
-- 12C.7 — RLS em nursing_evolutions: restringir INSERT
-- INSERT: apenas enfermeiro (não tec_enfermagem)
-- SELECT: admin + clínicos
-- ============================================================

DROP POLICY IF EXISTS "nursing_evo_select" ON public.nursing_evolutions;
CREATE POLICY "nursing_evo_select" ON public.nursing_evolutions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

DROP POLICY IF EXISTS "nursing_evo_insert" ON public.nursing_evolutions;
CREATE POLICY "nursing_evo_insert" ON public.nursing_evolutions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND professional_type = 'enfermeiro'
        )
      )
    )
  );

DROP POLICY IF EXISTS "nursing_evo_update" ON public.nursing_evolutions;
CREATE POLICY "nursing_evo_update" ON public.nursing_evolutions
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND professional_type = 'enfermeiro'
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid() AND professional_type = 'enfermeiro'
        )
      )
    )
  );

-- DELETE: apenas admin (sem alteração)

-- ============================================================
-- 12C.8 — RLS em referrals: restringir INSERT
-- INSERT: apenas clínicos (bloqueio total para secretária e faturista)
-- SELECT: admin + clínicos
-- ============================================================

DROP POLICY IF EXISTS "referrals_select" ON public.referrals;
CREATE POLICY "referrals_select" ON public.referrals
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
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
      OR public.is_clinical_professional(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- ============================================================
-- 12C.9 — RLS em financial_transactions e bills_*: restringir SELECT
-- SELECT: apenas admin e faturista. Clínicos não veem dados financeiros.
-- INSERT/UPDATE/DELETE financeiro: mantém admin-only (já existia)
-- ============================================================

-- financial_transactions: SELECT admin + faturista
DROP POLICY IF EXISTS "Admins can view financials in their tenant" ON public.financial_transactions;
CREATE POLICY "Admin or faturista can view financials"
  ON public.financial_transactions FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_admin_or_faturista(auth.uid())
  );

-- bills_payable: adicionar SELECT para faturista (admin já tem via policy ALL)
DROP POLICY IF EXISTS "Admins can manage bills payable" ON public.bills_payable;

CREATE POLICY "Admin can manage bills payable"
  ON public.bills_payable FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "Faturista can view bills payable"
  ON public.bills_payable FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND professional_type = 'faturista'
    )
  );

-- bills_receivable: adicionar SELECT para faturista (admin já tem via policy ALL)
DROP POLICY IF EXISTS "Admins can manage bills receivable" ON public.bills_receivable;

CREATE POLICY "Admin can manage bills receivable"
  ON public.bills_receivable FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

CREATE POLICY "Faturista can view bills receivable"
  ON public.bills_receivable FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND professional_type = 'faturista'
    )
  );

-- ============================================================
-- clinical_evolutions: reforçar SELECT para admin + clínicos
-- INSERT/UPDATE: clínicos apenas
-- ============================================================

DROP POLICY IF EXISTS "clinical_evolutions_select" ON public.clinical_evolutions;
CREATE POLICY "clinical_evolutions_select" ON public.clinical_evolutions
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
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
      OR public.is_clinical_professional(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_clinical_professional(auth.uid())
    )
  );

-- ============================================================
-- Índice para performance das funções de verificação de tipo
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id_professional_type
  ON public.profiles (user_id, professional_type);
