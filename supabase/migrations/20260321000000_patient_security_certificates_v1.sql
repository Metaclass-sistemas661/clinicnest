-- ============================================================
-- 1. TABELA: ATESTADOS MÉDICOS (medical_certificates)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medical_certificates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  certificate_type TEXT NOT NULL DEFAULT 'atestado'
                     CHECK (certificate_type IN ('atestado','declaracao_comparecimento','laudo','relatorio')),
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_off         INTEGER,                      -- dias de afastamento (se aplicável)
  start_date       DATE,                         -- início do afastamento
  end_date         DATE,                         -- fim do afastamento
  cid_code         TEXT,                         -- CID-10
  content          TEXT NOT NULL,                -- corpo do atestado
  notes            TEXT,
  digital_signature TEXT,
  printed_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_certificates FORCE ROW LEVEL SECURITY;

-- Staff: acesso por tenant
CREATE POLICY "medical_certificates_select" ON public.medical_certificates
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_certificates_insert" ON public.medical_certificates
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_certificates_update" ON public.medical_certificates
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "medical_certificates_delete" ON public.medical_certificates
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_medical_certificates_updated_at
  BEFORE UPDATE ON public.medical_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_medical_certificates_client ON public.medical_certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_medical_certificates_tenant ON public.medical_certificates(tenant_id, issued_at DESC);

-- ============================================================
-- 2. RPCs SEGURAS PARA PACIENTES
-- Cada RPC valida o vínculo patient_profiles antes de retornar dados.
-- Paciente SÓ vê registros vinculados ao seu client_id + tenant_id.
-- ============================================================

-- 2a. Receitas do paciente
CREATE OR REPLACE FUNCTION public.get_patient_prescriptions(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', p.id,
        'tenant_id', p.tenant_id,
        'prescription_type', p.prescription_type,
        'issued_at', p.issued_at,
        'validity_days', p.validity_days,
        'expires_at', p.expires_at,
        'medications', p.medications,
        'instructions', p.instructions,
        'status', p.status,
        'professional_name', COALESCE(pr.full_name, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.prescriptions p
      LEFT JOIN public.profiles pr ON pr.id = p.professional_id
      LEFT JOIN public.tenants t ON t.id = p.tenant_id
      WHERE p.client_id = v_link.client_id
        AND p.tenant_id = v_link.tenant_id
      ORDER BY p.issued_at DESC;
  END LOOP;
END;
$$;

-- 2b. Exames do paciente
CREATE OR REPLACE FUNCTION public.get_patient_exam_results(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', e.id,
        'tenant_id', e.tenant_id,
        'exam_type', e.exam_type,
        'exam_name', e.exam_name,
        'performed_at', e.performed_at,
        'lab_name', e.lab_name,
        'result_text', e.result_text,
        'reference_values', e.reference_values,
        'interpretation', e.interpretation,
        'status', e.status,
        'file_url', e.file_url,
        'file_name', e.file_name,
        'notes', e.notes,
        'requested_by_name', COALESCE(pr.full_name, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.exam_results e
      LEFT JOIN public.profiles pr ON pr.id = e.requested_by
      LEFT JOIN public.tenants t ON t.id = e.tenant_id
      WHERE e.client_id = v_link.client_id
        AND e.tenant_id = v_link.tenant_id
      ORDER BY e.created_at DESC;
  END LOOP;
END;
$$;

-- 2c. Atestados do paciente
CREATE OR REPLACE FUNCTION public.get_patient_certificates(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', mc.id,
        'tenant_id', mc.tenant_id,
        'certificate_type', mc.certificate_type,
        'issued_at', mc.issued_at,
        'days_off', mc.days_off,
        'start_date', mc.start_date,
        'end_date', mc.end_date,
        'cid_code', mc.cid_code,
        'content', mc.content,
        'notes', mc.notes,
        'professional_name', COALESCE(pr.full_name, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.medical_certificates mc
      LEFT JOIN public.profiles pr ON pr.id = mc.professional_id
      LEFT JOIN public.tenants t ON t.id = mc.tenant_id
      WHERE mc.client_id = v_link.client_id
        AND mc.tenant_id = v_link.tenant_id
      ORDER BY mc.issued_at DESC;
  END LOOP;
END;
$$;

-- 2d. Prontuários do paciente (somente dados não-confidenciais)
CREATE OR REPLACE FUNCTION public.get_patient_medical_records(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link record;
BEGIN
  FOR v_link IN
    SELECT pp.tenant_id, pp.client_id
    FROM public.patient_profiles pp
    WHERE pp.user_id = v_uid
      AND pp.is_active = true
      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)
  LOOP
    RETURN QUERY
      SELECT jsonb_build_object(
        'id', mr.id,
        'tenant_id', mr.tenant_id,
        'record_date', mr.record_date,
        'chief_complaint', mr.chief_complaint,
        'diagnosis', mr.diagnosis,
        'cid_code', mr.cid_code,
        'treatment_plan', mr.treatment_plan,
        'professional_name', COALESCE(pr.full_name, ''),
        'specialty_name', COALESCE(sp.name, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.medical_records mr
      LEFT JOIN public.profiles pr ON pr.id = mr.professional_id
      LEFT JOIN public.specialties sp ON sp.id = mr.specialty_id
      LEFT JOIN public.tenants t ON t.id = mr.tenant_id
      WHERE mr.client_id = v_link.client_id
        AND mr.tenant_id = v_link.tenant_id
        AND mr.is_confidential = false  -- NUNCA expor prontuários confidenciais
      ORDER BY mr.record_date DESC;
  END LOOP;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.get_patient_prescriptions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_exam_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_certificates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_medical_records(uuid) TO authenticated;
