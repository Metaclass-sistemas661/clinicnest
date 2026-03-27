-- ============================================================================
-- FIX: Timeline do portal deve exibir consultas 'arrived' (compareceu)
-- 
-- Problema: Apenas 'completed' aparecia na timeline, mas 'arrived' = compareceu
-- Solução: Incluir status 'arrived' e 'completed' nas consultas da timeline
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
  -- Consultas realizadas (arrived = compareceu, completed = finalizada)
  SELECT a.id, 'appointment'::text, a.scheduled_at,
    COALESCE(s.name, 'Consulta')::text,
    COALESCE(a.notes, '')::text,
    COALESCE(p.full_name, '')::text,
    jsonb_build_object('status', a.status, 'procedure_id', a.procedure_id)
  FROM public.appointments a
  LEFT JOIN public.procedures s ON s.id = a.procedure_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  WHERE a.patient_id = v_client_id 
    AND a.tenant_id = v_tenant_id 
    AND a.status IN ('completed', 'arrived')  -- CORRIGIDO: incluir arrived

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
  WHERE er.patient_id = v_client_id AND er.tenant_id = v_tenant_id

  UNION ALL

  -- Atestados
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

  -- Laudos médicos
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

  -- Encaminhamentos
  SELECT rf.id, 'referral'::text, rf.created_at,
    ('Encaminhamento — ' || COALESCE(sp.name, 'Especialista'))::text,
    LEFT(COALESCE(rf.reason, ''), 200)::text,
    COALESCE(from_prof.full_name, '')::text,
    jsonb_build_object('status', rf.status, 'priority', rf.priority)
  FROM public.referrals rf
  LEFT JOIN public.profiles from_prof ON from_prof.id = rf.from_professional
  LEFT JOIN public.specialties sp ON sp.id = rf.to_specialty_id
  WHERE rf.patient_id = v_client_id AND rf.tenant_id = v_tenant_id

  ORDER BY 3 DESC LIMIT p_limit;
END;
$$;

-- Manter grants
GRANT EXECUTE ON FUNCTION public.get_patient_health_timeline(integer) TO authenticated;
