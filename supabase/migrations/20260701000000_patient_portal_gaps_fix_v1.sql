-- ============================================================================
-- MIGRAÇÃO: Correções de Gaps do Portal do Paciente (G1, G6, G7, G8)
-- Arquivo: 20260701000000_patient_portal_gaps_fix_v1.sql
-- ============================================================================

-- ============================================================================
-- G1: Nova RPC para expor medical_reports (Laudos) ao paciente
-- O portal só lia medical_certificates. Laudos (medical_reports) ficavam ocultos.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_medical_reports(
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

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
        'tipo', mr.tipo,
        'finalidade', mr.finalidade,
        'historia_clinica', mr.historia_clinica,
        'exame_fisico', mr.exame_fisico,
        'exames_complementares', mr.exames_complementares,
        'diagnostico', mr.diagnostico,
        'cid10', mr.cid10,
        'conclusao', mr.conclusao,
        'observacoes', mr.observacoes,
        'status', mr.status,
        'signed_at', mr.signed_at,
        'created_at', mr.created_at,
        'professional_name', COALESCE(pr.full_name, ''),
        'professional_council', COALESCE(pr.council_number, ''),
        'clinic_name', COALESCE(t.name, '')
      )
      FROM public.medical_reports mr
      LEFT JOIN public.profiles pr ON pr.id = mr.professional_id
      LEFT JOIN public.tenants t ON t.id = mr.tenant_id
      WHERE mr.patient_id = v_link.client_id
        AND mr.tenant_id = v_link.tenant_id
        AND mr.status IN ('finalizado', 'assinado')
      ORDER BY mr.created_at DESC;
  END LOOP;
END;
$$;

-- ============================================================================
-- G6: Atualizar RPC get_patient_exam_results com novos campos do overhaul
-- (tuss_code, priority, exam_category, performed_by)
-- ============================================================================
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

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
        'clinic_name', COALESCE(t.name, ''),
        -- Novos campos do overhaul
        'tuss_code', e.tuss_code,
        'priority', e.priority,
        'exam_category', e.exam_category,
        'performed_by_name', COALESCE(perf.full_name, ''),
        'created_at', e.created_at
      )
      FROM public.exam_results e
      LEFT JOIN public.profiles pr ON pr.id = e.requested_by
      LEFT JOIN public.profiles perf ON perf.id = e.performed_by
      LEFT JOIN public.tenants t ON t.id = e.tenant_id
      WHERE e.client_id = v_link.client_id
        AND e.tenant_id = v_link.tenant_id
      ORDER BY e.created_at DESC;
  END LOOP;
END;
$$;

-- ============================================================================
-- G7: Restaurar atestados na timeline + adicionar laudos e encaminhamentos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_health_timeline(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid, event_type text, event_date timestamptz, title text, 
  description text, professional_name text, metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  -- Consultas completadas
  SELECT a.id, 'appointment'::text, a.scheduled_at, 
    COALESCE(s.name, 'Consulta')::text,
    COALESCE(a.notes, '')::text,
    COALESCE(p.full_name, '')::text,
    jsonb_build_object('status', a.status, 'service_id', a.service_id)
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.client_id = v_client_id AND a.tenant_id = v_tenant_id AND a.status = 'completed'

  UNION ALL

  -- Receitas
  SELECT pr.id, 'prescription'::text, pr.created_at,
    ('Receita ' || COALESCE(pr.prescription_type, 'simples'))::text,
    LEFT(COALESCE(pr.medications, ''), 200)::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('type', pr.prescription_type, 'status', pr.status)
  FROM public.prescriptions pr
  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id
  WHERE pr.patient_id = v_client_id AND pr.tenant_id = v_tenant_id

  UNION ALL

  -- Exames
  SELECT er.id, 'exam'::text, er.created_at,
    COALESCE(er.exam_name, 'Exame')::text,
    COALESCE(er.result_text, '')::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('status', er.status, 'priority', er.priority)
  FROM public.exam_results er
  LEFT JOIN public.profiles prof ON prof.id = er.requested_by
  WHERE er.client_id = v_client_id AND er.tenant_id = v_tenant_id

  UNION ALL

  -- Atestados (G7: restaurado)
  SELECT mc.id, 'certificate'::text, mc.issued_at,
    CASE mc.certificate_type
      WHEN 'atestado' THEN 'Atestado Médico'
      WHEN 'declaracao_comparecimento' THEN 'Declaração de Comparecimento'
      WHEN 'laudo' THEN 'Laudo'
      WHEN 'relatorio' THEN 'Relatório'
      ELSE 'Atestado'
    END::text,
    LEFT(COALESCE(mc.content, ''), 200)::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('type', mc.certificate_type, 'days_off', mc.days_off, 'cid_code', mc.cid_code)
  FROM public.medical_certificates mc
  LEFT JOIN public.profiles prof ON prof.id = mc.professional_id
  WHERE mc.patient_id = v_client_id AND mc.tenant_id = v_tenant_id

  UNION ALL

  -- Laudos médicos (novo — expondo medical_reports)
  SELECT mr.id, 'medical_report'::text, mr.created_at,
    CASE mr.tipo
      WHEN 'medico' THEN 'Laudo Médico'
      WHEN 'pericial' THEN 'Laudo Pericial'
      WHEN 'aptidao' THEN 'Atestado de Aptidão'
      WHEN 'capacidade' THEN 'Laudo de Capacidade'
      WHEN 'complementar' THEN 'Laudo Complementar'
      WHEN 'psicologico' THEN 'Laudo Psicológico'
      WHEN 'neuropsicologico' THEN 'Avaliação Neuropsicológica'
      WHEN 'ocupacional' THEN 'Laudo Ocupacional'
      ELSE 'Laudo'
    END::text,
    LEFT(COALESCE(mr.conclusao, ''), 200)::text,
    COALESCE(prof.full_name, '')::text,
    jsonb_build_object('tipo', mr.tipo, 'status', mr.status, 'cid10', mr.cid10)
  FROM public.medical_reports mr
  LEFT JOIN public.profiles prof ON prof.id = mr.professional_id
  WHERE mr.patient_id = v_client_id AND mr.tenant_id = v_tenant_id
    AND mr.status IN ('finalizado', 'assinado')

  UNION ALL

  -- Encaminhamentos (novo — expondo referrals)
  SELECT rf.id, 'referral'::text, rf.created_at,
    ('Encaminhamento — ' || COALESCE(sp.name, 'Especialista'))::text,
    LEFT(COALESCE(rf.reason, ''), 200)::text,
    COALESCE(from_prof.full_name, '')::text,
    jsonb_build_object('status', rf.status, 'priority', rf.priority)
  FROM public.referrals rf
  LEFT JOIN public.profiles from_prof ON from_prof.id = rf.from_professional
  LEFT JOIN public.specialties sp ON sp.id = rf.to_specialty_id
  WHERE rf.patient_id = v_client_id AND rf.tenant_id = v_tenant_id

  ORDER BY event_date DESC LIMIT p_limit;
END;
$$;

-- ============================================================================
-- G8: Fix get_patient_active_medications — medications é TEXT, não JSONB.
-- Também itera TODOS os medicamentos, não só o índice 0.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_patient_active_medications();
CREATE OR REPLACE FUNCTION public.get_patient_active_medications()
RETURNS TABLE (
  id uuid, medication_name text, dosage text, frequency text, 
  start_date date, end_date date, professional_name text, notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  -- Tenta tratar como JSONB array; se falhar, usa texto plano
  SELECT 
    pr.id,
    CASE 
      WHEN pr.medications IS NOT NULL AND pr.medications LIKE '[%' THEN
        COALESCE((med_item->>'name')::text, LEFT(pr.medications, 100))
      ELSE
        LEFT(pr.medications, 100)
    END,
    CASE 
      WHEN pr.medications IS NOT NULL AND pr.medications LIKE '[%' THEN
        COALESCE((med_item->>'dosage')::text, '')
      ELSE ''
    END,
    CASE 
      WHEN pr.medications IS NOT NULL AND pr.medications LIKE '[%' THEN
        COALESCE((med_item->>'frequency')::text, COALESCE((med_item->>'posologia')::text, ''))
      ELSE ''
    END,
    pr.created_at::date,
    COALESCE(pr.expires_at::date, (pr.created_at + (COALESCE(pr.validity_days, 30) * interval '1 day'))::date),
    COALESCE(prof.full_name, '')::text,
    COALESCE(pr.instructions, '')::text
  FROM public.prescriptions pr
  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id
  -- Expande JSONB array se possível, senão retorna uma linha
  LEFT JOIN LATERAL (
    SELECT value AS med_item
    FROM jsonb_array_elements(
      CASE 
        WHEN pr.medications IS NOT NULL AND pr.medications LIKE '[%' THEN 
          pr.medications::jsonb
        ELSE 
          NULL
      END
    )
  ) meds ON true
  WHERE pr.patient_id = v_client_id AND pr.tenant_id = v_tenant_id
    AND pr.status = 'ativo'
    AND pr.created_at > now() - interval '90 days'
  ORDER BY pr.created_at DESC;
END;
$$;

-- ============================================================================
-- RLS Policy para patient selecionar medical_reports via RPC
-- (A tabela já tem RLS para staff; precisamos permitir leitura via 
-- patient_profiles para o security definer da RPC acima funcionar)
-- ============================================================================

-- Garantir que medical_reports tem RLS ativado
ALTER TABLE IF EXISTS public.medical_reports ENABLE ROW LEVEL SECURITY;

-- Adicionar policy para paciente ler seus laudos (via patient_profiles)
DROP POLICY IF EXISTS "medical_reports_patient_select" ON public.medical_reports;
CREATE POLICY "medical_reports_patient_select" ON public.medical_reports
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT pp.client_id FROM public.patient_profiles pp 
      WHERE pp.user_id = auth.uid() AND pp.is_active = true
    )
    OR
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- ============================================================================
-- Grant execução das novas funções
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_patient_medical_reports(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_exam_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_health_timeline(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_active_medications() TO authenticated;
