-- ============================================================================
-- CONSOLIDADO: Todas as migrações pendentes do portal do paciente
-- Execute este SQL inteiro no Supabase SQL Editor (uma única vez)
--
-- Inclui:
--   20260703300000 — Fix patient linking chain (validate_patient_access,
--                    activate_patient_account, auto_link_patient, backfill)
--   20260703400000 — Fix service_id→procedure_id + client_id→patient_id
--                    em 6 funções + RLS tenants para pacientes
--   20260703500000 — Fix get_patient_dependents columns (dependent_id etc)
--   20260703600000 — Habilitar patient_booking_enabled para todos os tenants
-- ============================================================================

-- ============================================================================
-- PARTE 1: FIX PATIENT LINKING CHAIN (20260703300000)
-- ============================================================================

-- 1A. validate_patient_access — retornar patient_id no JSON
CREATE OR REPLACE FUNCTION public.validate_patient_access(
  p_identifier TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_identifier TEXT := btrim(upper(p_identifier));
  v_cpf_clean TEXT;
  v_status TEXT;
BEGIN
  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Identificador não informado');
  END IF;

  SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE upper(p.access_code) = v_identifier
  LIMIT 1;

  IF v_patient IS NULL THEN
    v_cpf_clean := regexp_replace(p_identifier, '[^0-9]', '', 'g');
    IF length(v_cpf_clean) >= 11 THEN
      SELECT p.id, p.name, p.email, p.phone, p.tenant_id, p.user_id, p.access_code, p.cpf,
             t.name AS clinic_name
      INTO v_patient
      FROM public.patients p
      LEFT JOIN public.tenants t ON t.id = p.tenant_id
      WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = v_cpf_clean
      LIMIT 1;
    END IF;
  END IF;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_patient.user_id IS NOT NULL THEN v_status := 'has_account';
  ELSE v_status := 'new';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', v_status,
    'patient_id', v_patient.id,
    'client_id', v_patient.id,
    'client_name', v_patient.name,
    'client_email', v_patient.email,
    'clinic_name', v_patient.clinic_name,
    'masked_email', CASE
      WHEN v_patient.email IS NOT NULL AND v_patient.email <> '' THEN
        substr(v_patient.email, 1, 2) || '***@' || split_part(v_patient.email, '@', 2)
      ELSE NULL
    END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_patient_access(TEXT) TO authenticated;

-- 1B. activate_patient_account — usar patients diretamente
CREATE OR REPLACE FUNCTION public.activate_patient_account(
  p_client_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_pp_id UUID;
BEGIN
  SELECT id, tenant_id, name, user_id INTO v_patient
  FROM public.patients WHERE id = p_client_id;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLIENT_NOT_FOUND');
  END IF;
  IF v_patient.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ACTIVATED');
  END IF;

  UPDATE public.patients SET user_id = p_user_id, updated_at = now() WHERE id = p_client_id;

  INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
  VALUES (p_user_id, v_patient.tenant_id, p_client_id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, is_active = true, updated_at = now()
  RETURNING id INTO v_pp_id;

  RETURN jsonb_build_object('success', true, 'patient_profile_id', v_pp_id, 'client_name', v_patient.name);
END;
$$;
REVOKE ALL ON FUNCTION public.activate_patient_account(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.activate_patient_account(UUID, UUID) TO service_role;

-- 1C. auto_link_patient — auto-vincula paciente após login
CREATE OR REPLACE FUNCTION public.auto_link_patient()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_patient RECORD;
  v_pp_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  IF EXISTS (SELECT 1 FROM public.patient_profiles WHERE user_id = v_user_id AND is_active = true) THEN
    RETURN jsonb_build_object('linked', true, 'reason', 'ALREADY_LINKED');
  END IF;

  SELECT id, tenant_id, name INTO v_patient FROM public.patients WHERE user_id = v_user_id LIMIT 1;

  IF v_patient IS NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    IF v_user_email IS NOT NULL AND v_user_email <> '' THEN
      SELECT id, tenant_id, name INTO v_patient FROM public.patients WHERE lower(email) = lower(v_user_email) LIMIT 1;
      IF v_patient IS NOT NULL THEN
        UPDATE public.patients SET user_id = v_user_id, updated_at = now() WHERE id = v_patient.id AND user_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'PATIENT_NOT_FOUND');
  END IF;

  INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
  VALUES (v_user_id, v_patient.tenant_id, v_patient.id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, is_active = true, updated_at = now()
  RETURNING id INTO v_pp_id;

  RETURN jsonb_build_object('linked', true, 'reason', 'AUTO_LINKED', 'patient_profile_id', v_pp_id, 'patient_name', v_patient.name);
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_link_patient() TO authenticated;

-- 1D. Backfill patient_profiles
DO $$
DECLARE r RECORD; v_count int := 0;
BEGIN
  FOR r IN
    SELECT p.id AS patient_id, p.user_id, p.tenant_id
    FROM public.patients p
    WHERE p.user_id IS NOT NULL AND p.tenant_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = p.user_id AND pp.tenant_id = p.tenant_id)
  LOOP
    INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
    VALUES (r.user_id, r.tenant_id, r.patient_id) ON CONFLICT (user_id, tenant_id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfill: % patient_profiles rows created', v_count;
END;
$$;

-- ============================================================================
-- PARTE 2: FIX SERVICE_ID → PROCEDURE_ID + RLS (20260703400000)
-- ============================================================================

-- 2A. get_patient_dashboard_summary
CREATE OR REPLACE FUNCTION public.get_patient_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid; v_tenant_id uuid; v_clinic_name text;
  v_upcoming_appointments jsonb; v_upcoming_teleconsultas jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('is_linked', false, 'clinic_name', null, 'upcoming_appointments', '[]'::jsonb, 'upcoming_teleconsultas', '[]'::jsonb);
  END IF;

  SELECT pp.client_id, pp.tenant_id, t.name INTO v_client_id, v_tenant_id, v_clinic_name
  FROM public.patient_profiles pp JOIN public.tenants t ON t.id = pp.tenant_id
  WHERE pp.user_id = v_user_id AND pp.is_active = true LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('is_linked', false, 'clinic_name', null, 'upcoming_appointments', '[]'::jsonb, 'upcoming_teleconsultas', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb) INTO v_upcoming_appointments
  FROM (
    SELECT a.id, a.scheduled_at, s.name AS service_name, p.full_name AS professional_name, t.name AS clinic_name, a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending','confirmed') AND a.scheduled_at > now()
      AND (a.telemedicine IS NULL OR a.telemedicine = false)
    ORDER BY a.scheduled_at LIMIT 5
  ) r;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.scheduled_at), '[]'::jsonb) INTO v_upcoming_teleconsultas
  FROM (
    SELECT a.id, a.scheduled_at, s.name AS service_name, p.full_name AS professional_name, t.name AS clinic_name, a.telemedicine
    FROM public.appointments a
    LEFT JOIN public.procedures s ON s.id = a.procedure_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.patient_id = v_client_id AND a.tenant_id = v_tenant_id
      AND a.status IN ('pending','confirmed') AND a.scheduled_at > now() AND a.telemedicine = true
    ORDER BY a.scheduled_at LIMIT 3
  ) r;

  RETURN jsonb_build_object('is_linked', true, 'clinic_name', v_clinic_name, 'upcoming_appointments', v_upcoming_appointments, 'upcoming_teleconsultas', v_upcoming_teleconsultas);
END;
$$;

-- 2B. get_patient_health_timeline
CREATE OR REPLACE FUNCTION public.get_patient_health_timeline(p_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, event_type text, event_date timestamptz, title text, description text, professional_name text, metadata jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client_id uuid; v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.is_active = true LIMIT 1;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT a.id, 'appointment'::text, a.scheduled_at, COALESCE(s.name,'Consulta')::text, COALESCE(a.notes,'')::text, COALESCE(p.full_name,'')::text, jsonb_build_object('status',a.status,'procedure_id',a.procedure_id)
  FROM public.appointments a LEFT JOIN public.procedures s ON s.id=a.procedure_id LEFT JOIN public.profiles p ON p.id=a.professional_id
  WHERE a.patient_id=v_client_id AND a.tenant_id=v_tenant_id AND a.status='completed'
  UNION ALL
  SELECT pr.id, 'prescription'::text, pr.created_at, ('Receita '||COALESCE(pr.prescription_type,'simples'))::text, LEFT(COALESCE(pr.medications,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('type',pr.prescription_type,'status',pr.status)
  FROM public.prescriptions pr LEFT JOIN public.profiles prof ON prof.id=pr.professional_id WHERE pr.patient_id=v_client_id AND pr.tenant_id=v_tenant_id
  UNION ALL
  SELECT er.id, 'exam'::text, er.created_at, COALESCE(er.exam_name,'Exame')::text, COALESCE(er.result_text,'')::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('status',er.status,'priority',er.priority)
  FROM public.exam_results er LEFT JOIN public.profiles prof ON prof.id=er.requested_by WHERE er.patient_id=v_client_id AND er.tenant_id=v_tenant_id
  UNION ALL
  SELECT mc.id, 'certificate'::text, mc.issued_at, CASE mc.certificate_type WHEN 'atestado' THEN 'Atestado Médico' WHEN 'declaracao_comparecimento' THEN 'Declaração de Comparecimento' WHEN 'laudo' THEN 'Laudo' WHEN 'relatorio' THEN 'Relatório' ELSE 'Atestado' END::text, LEFT(COALESCE(mc.content,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('type',mc.certificate_type,'days_off',mc.days_off,'cid_code',mc.cid_code)
  FROM public.medical_certificates mc LEFT JOIN public.profiles prof ON prof.id=mc.professional_id WHERE mc.patient_id=v_client_id AND mc.tenant_id=v_tenant_id
  UNION ALL
  SELECT mr.id, 'medical_report'::text, mr.created_at, CASE mr.tipo WHEN 'medico' THEN 'Laudo Médico' WHEN 'pericial' THEN 'Laudo Pericial' WHEN 'aptidao' THEN 'Atestado de Aptidão' WHEN 'capacidade' THEN 'Laudo de Capacidade' WHEN 'complementar' THEN 'Laudo Complementar' WHEN 'psicologico' THEN 'Laudo Psicológico' WHEN 'neuropsicologico' THEN 'Avaliação Neuropsicológica' WHEN 'ocupacional' THEN 'Laudo Ocupacional' ELSE 'Laudo' END::text, LEFT(COALESCE(mr.conclusao,''),200)::text, COALESCE(prof.full_name,'')::text, jsonb_build_object('tipo',mr.tipo,'status',mr.status,'cid10',mr.cid10)
  FROM public.medical_reports mr LEFT JOIN public.profiles prof ON prof.id=mr.professional_id WHERE mr.patient_id=v_client_id AND mr.tenant_id=v_tenant_id AND mr.status IN ('finalizado','assinado')
  UNION ALL
  SELECT rf.id, 'referral'::text, rf.created_at, ('Encaminhamento — '||COALESCE(sp.name,'Especialista'))::text, LEFT(COALESCE(rf.reason,''),200)::text, COALESCE(from_prof.full_name,'')::text, jsonb_build_object('status',rf.status,'priority',rf.priority)
  FROM public.referrals rf LEFT JOIN public.profiles from_prof ON from_prof.id=rf.from_professional LEFT JOIN public.specialties sp ON sp.id=rf.to_specialty_id WHERE rf.patient_id=v_client_id AND rf.tenant_id=v_tenant_id
  ORDER BY event_date DESC LIMIT p_limit;
END;
$$;

-- 2C. get_patient_pending_ratings
DROP FUNCTION IF EXISTS public.get_patient_pending_ratings();
CREATE OR REPLACE FUNCTION public.get_patient_pending_ratings()
RETURNS TABLE (appointment_id uuid, scheduled_at timestamptz, completed_at timestamptz, service_name text, professional_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT pp.client_id INTO v_client_id FROM public.patient_profiles pp WHERE pp.user_id=auth.uid() AND pp.is_active=true LIMIT 1;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT a.id, a.scheduled_at, a.updated_at AS completed_at, COALESCE(s.name,'Consulta')::text, COALESCE(p.full_name,'')::text
  FROM public.appointments a
  LEFT JOIN public.procedures s ON s.id=a.procedure_id
  LEFT JOIN public.profiles p ON p.id=a.professional_id
  WHERE a.patient_id=v_client_id AND a.status='completed' AND a.scheduled_at > now()-interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.appointment_ratings ar WHERE ar.appointment_id=a.id)
  ORDER BY a.scheduled_at DESC LIMIT 5;
END;
$$;

-- 2D. get_patient_telemedicine_appointments
CREATE OR REPLACE FUNCTION public.get_patient_telemedicine_appointments(p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid := auth.uid(); v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)),'[]'::jsonb) INTO v_result
  FROM (
    SELECT a.id, a.tenant_id, a.scheduled_at, a.duration_minutes, a.status, s.name AS service_name, p.full_name AS professional_name, t.name AS clinic_name
    FROM public.appointments a
    JOIN public.patient_profiles pp ON pp.tenant_id=a.tenant_id AND pp.client_id=a.patient_id
    LEFT JOIN public.procedures s ON s.id=a.procedure_id
    LEFT JOIN public.profiles p ON p.id=a.professional_id
    LEFT JOIN public.tenants t ON t.id=a.tenant_id
    WHERE pp.user_id=v_user_id AND pp.is_active=true AND a.telemedicine=true AND a.status IN ('pending','confirmed')
      AND a.scheduled_at >= p_date::timestamptz AND a.scheduled_at < (p_date+interval '1 day')::timestamptz
    ORDER BY a.scheduled_at
  ) r;
  RETURN v_result;
END;
$$;

-- 2E. check_patient_achievements
CREATE OR REPLACE FUNCTION public.check_patient_achievements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid; v_client_id uuid; v_tenant_id uuid; v_new text[]:='{}'; v_appt int; v_rat int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('new_achievements',v_new); END IF;
  SELECT pp.client_id,pp.tenant_id INTO v_client_id,v_tenant_id FROM public.patient_profiles pp WHERE pp.user_id=v_user_id AND pp.is_active=true LIMIT 1;
  IF v_client_id IS NULL THEN RETURN jsonb_build_object('new_achievements',v_new); END IF;

  SELECT COUNT(*) INTO v_appt FROM public.appointments WHERE patient_id=v_client_id AND status='completed';
  IF v_appt>=1 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'first_appointment','Primeira Consulta') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Primeira Consulta'); END IF; END IF;
  IF v_appt>=5 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'five_appointments','Paciente Frequente') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Paciente Frequente'); END IF; END IF;
  IF v_appt>=10 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'ten_appointments','Paciente Fiel') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Paciente Fiel'); END IF; END IF;
  SELECT COUNT(*) INTO v_rat FROM public.appointment_ratings WHERE patient_user_id=v_user_id;
  IF v_rat>=1 THEN INSERT INTO public.patient_achievements(patient_user_id,achievement_type,achievement_name) VALUES(v_user_id,'first_rating','Avaliador') ON CONFLICT DO NOTHING; IF FOUND THEN v_new:=array_append(v_new,'Avaliador'); END IF; END IF;
  RETURN jsonb_build_object('new_achievements',v_new);
END;
$$;

-- 2F. RLS tenants para pacientes
DROP POLICY IF EXISTS "Patients can view their linked tenant" ON public.tenants;
CREATE POLICY "Patients can view their linked tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id IN (SELECT pp.tenant_id FROM public.patient_profiles pp WHERE pp.user_id=auth.uid() AND pp.is_active=true));

-- 2G. RLS patient_dependents
DROP POLICY IF EXISTS "patient_dependents_patient_select" ON public.patient_dependents;
CREATE POLICY "patient_dependents_patient_select" ON public.patient_dependents
  FOR SELECT TO authenticated
  USING (parent_patient_id IN (SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id=auth.uid() AND pp.is_active=true));

-- Grants parte 2
GRANT EXECUTE ON FUNCTION public.get_patient_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_health_timeline(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_pending_ratings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_telemedicine_appointments(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_patient_achievements() TO authenticated;

-- ============================================================================
-- PARTE 3: FIX GET_PATIENT_DEPENDENTS COLUMNS (20260703500000)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_patient_dependents();
CREATE OR REPLACE FUNCTION public.get_patient_dependents()
RETURNS TABLE (dependent_id uuid, dependent_name text, relationship text, email text, phone text, birth_date date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_patient_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT pp.client_id INTO v_patient_id FROM public.patient_profiles pp WHERE pp.user_id=auth.uid() AND pp.is_active=true LIMIT 1;
  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT pd.id AS dependent_id, p.name AS dependent_name, pd.relationship, p.email, p.phone, p.date_of_birth AS birth_date
  FROM public.patient_dependents pd JOIN public.patients p ON p.id=pd.dependent_patient_id
  WHERE pd.parent_patient_id=v_patient_id AND pd.is_active=true ORDER BY p.name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_patient_dependents() TO authenticated;

-- ============================================================================
-- PARTE 4: HABILITAR AGENDAMENTO PORTAL (20260703600000)
-- ============================================================================
UPDATE public.tenants SET patient_booking_enabled = true WHERE patient_booking_enabled = false;
ALTER TABLE public.tenants ALTER COLUMN patient_booking_enabled SET DEFAULT true;

-- ============================================================================
-- FIM — Tudo aplicado!
-- ============================================================================
