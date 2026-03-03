-- ============================================================================
-- FIX: Corrigir funções do portal do paciente após rename client_id → patient_id
-- As tabelas medical_certificates, prescriptions, exam_results, appointments e
-- medical_records tiveram client_id renomeado para patient_id na migração
-- 20260330300000, mas as funções SECURITY DEFINER do portal não foram atualizadas.
-- ============================================================================

-- ============================================================================
-- 1. FIX notify_patient() — trigger AFTER INSERT em medical_certificates,
--    prescriptions e exam_results. Usava NEW.client_id que não existe mais.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient record;
  v_type text;
  v_title text;
  v_body text;
  v_prof_name text;
  v_clinic_name text;
  v_metadata jsonb;
BEGIN
  -- Buscar todos os pacientes vinculados a este patient_id + tenant_id
  FOR v_patient IN
    SELECT pp.user_id
    FROM public.patient_profiles pp
    WHERE pp.client_id = NEW.patient_id
      AND pp.tenant_id = NEW.tenant_id
      AND pp.is_active = true
  LOOP
    -- Buscar nome do profissional (se houver)
    v_prof_name := '';
    IF TG_TABLE_NAME = 'exam_results' THEN
      SELECT COALESCE(p.full_name, '') INTO v_prof_name
      FROM public.profiles p WHERE p.id = NEW.requested_by;
    ELSE
      SELECT COALESCE(p.full_name, '') INTO v_prof_name
      FROM public.profiles p WHERE p.id = NEW.professional_id;
    END IF;

    -- Buscar nome da clínica
    SELECT COALESCE(t.name, '') INTO v_clinic_name
    FROM public.tenants t WHERE t.id = NEW.tenant_id;

    -- Definir tipo, título e corpo conforme a tabela de origem
    IF TG_TABLE_NAME = 'medical_certificates' THEN
      v_type := 'certificate_released';
      v_title := 'Novo atestado disponível';
      v_body := format('O Dr(a). %s emitiu um %s para você.',
        v_prof_name,
        CASE NEW.certificate_type
          WHEN 'atestado' THEN 'atestado médico'
          WHEN 'declaracao_comparecimento' THEN 'declaração de comparecimento'
          WHEN 'laudo' THEN 'laudo médico'
          WHEN 'relatorio' THEN 'relatório médico'
          ELSE 'documento médico'
        END
      );
      v_metadata := jsonb_build_object(
        'certificate_id', NEW.id,
        'certificate_type', NEW.certificate_type,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );

    ELSIF TG_TABLE_NAME = 'prescriptions' THEN
      v_type := 'prescription_released';
      v_title := 'Nova receita disponível';
      v_body := format('O Dr(a). %s emitiu uma receita %s para você.',
        v_prof_name,
        CASE NEW.prescription_type
          WHEN 'simples' THEN 'simples'
          WHEN 'especial_b' THEN 'especial B'
          WHEN 'especial_a' THEN 'especial A'
          WHEN 'antimicrobiano' THEN 'de antimicrobiano'
          ELSE ''
        END
      );
      v_metadata := jsonb_build_object(
        'prescription_id', NEW.id,
        'prescription_type', NEW.prescription_type,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );

    ELSIF TG_TABLE_NAME = 'exam_results' THEN
      v_type := 'exam_released';
      v_title := 'Novo resultado de exame disponível';
      v_body := format('O resultado do exame "%s" já está disponível.', COALESCE(NEW.exam_name, 'Exame'));
      v_metadata := jsonb_build_object(
        'exam_id', NEW.id,
        'exam_name', NEW.exam_name,
        'professional_name', v_prof_name,
        'clinic_name', v_clinic_name
      );
    END IF;

    INSERT INTO public.patient_notifications (user_id, type, title, body, metadata)
    VALUES (v_patient.user_id, v_type, v_title, v_body, v_metadata);
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. FIX get_patient_dashboard_summary() — usava a.client_id (appointments)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_tenant_id uuid;
  v_clinic_name text;
  v_upcoming_appointments jsonb;
  v_upcoming_teleconsultas jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_linked', false,
      'clinic_name', null,
      'upcoming_appointments', '[]'::jsonb,
      'upcoming_teleconsultas', '[]'::jsonb
    );
  END IF;

  -- Check if patient is linked (patient_profiles.client_id não foi renomeado)
  SELECT pp.client_id, pp.tenant_id, t.name
  INTO v_client_id, v_tenant_id, v_clinic_name
  FROM public.patient_profiles pp
  JOIN public.tenants t ON t.id = pp.tenant_id
  WHERE pp.user_id = v_user_id
    AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_linked', false,
      'clinic_name', null,
      'upcoming_appointments', '[]'::jsonb,
      'upcoming_teleconsultas', '[]'::jsonb
    );
  END IF;

  -- Get upcoming appointments (non-telemedicine)
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb)
  INTO v_upcoming_appointments
  FROM (
    SELECT
      a.id,
      a.scheduled_at,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name,
      a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id
      AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending', 'confirmed')
      AND a.scheduled_at > now()
      AND (a.telemedicine IS NULL OR a.telemedicine = false)
    ORDER BY a.scheduled_at
    LIMIT 5
  ) r;

  -- Get upcoming teleconsultas
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb)
  INTO v_upcoming_teleconsultas
  FROM (
    SELECT
      a.id,
      a.scheduled_at,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name,
      a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id
      AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending', 'confirmed')
      AND a.scheduled_at > now()
      AND a.telemedicine = true
    ORDER BY a.scheduled_at
    LIMIT 3
  ) r;

  RETURN jsonb_build_object(
    'is_linked', true,
    'clinic_name', v_clinic_name,
    'upcoming_appointments', v_upcoming_appointments,
    'upcoming_teleconsultas', v_upcoming_teleconsultas
  );
END;
$$;

-- ============================================================================
-- 3. FIX get_patient_certificates() — usava mc.client_id
-- ============================================================================
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
      WHERE mc.patient_id = v_link.client_id
        AND mc.tenant_id = v_link.tenant_id
      ORDER BY mc.issued_at DESC;
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. FIX get_patient_medical_records() — usava mr.client_id
-- ============================================================================
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
      WHERE mr.patient_id = v_link.client_id
        AND mr.tenant_id = v_link.tenant_id
        AND mr.is_confidential = false
      ORDER BY mr.record_date DESC;
  END LOOP;
END;
$$;

-- ============================================================================
-- 5. FIX get_patient_prescriptions() — usava p.client_id
-- ============================================================================
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
      WHERE p.patient_id = v_link.client_id
        AND p.tenant_id = v_link.tenant_id
      ORDER BY p.issued_at DESC;
  END LOOP;
END;
$$;

-- ============================================================================
-- 6. FIX get_patient_exam_results() — usava e.client_id
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
      WHERE e.patient_id = v_link.client_id
        AND e.tenant_id = v_link.tenant_id
      ORDER BY e.created_at DESC;
  END LOOP;
END;
$$;

-- ============================================================================
-- 7. FIX get_patient_health_timeline() — usava a.client_id e er.client_id
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
  WHERE a.patient_id = v_client_id AND a.tenant_id = v_tenant_id AND a.status = 'completed'

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

  ORDER BY event_date DESC LIMIT p_limit;
END;
$$;

-- ============================================================================
-- Grants (reafirmar para segurança)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_patient_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_certificates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_medical_records(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_prescriptions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_exam_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_health_timeline(integer) TO authenticated;
