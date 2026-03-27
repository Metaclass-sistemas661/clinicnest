-- ============================================================================
-- FIX: Sincronizar RPCs de Saúde do Portal do Paciente com PatientSaude.tsx
--
-- Problemas corrigidos:
--   1. get_patient_vital_signs_history — usava medical_records (sem sinais vitais).
--      Corrigido para usar triage_records (tabela real de sinais vitais).
--   2. get_patient_active_medications  — retornava start_date/end_date.
--      Corrigido para prescription_date/expiry_date/is_expired.
--   3. get_patient_health_info         — não retornava allergies nem last_vital_signs.
--      Restaurado com dados de patients + triage_records.
--   4. get_patient_vaccinations        — retornava applied_at/lot_number/next_dose_at.
--      Corrigido para administered_at/batch_number/administered_by/next_dose_date.
-- ============================================================================

-- ============================================================================
-- 1. get_patient_vital_signs_history
--    Corrigido: usa triage_records (patient_id após rename 20260330300000)
--    Retorna: recorded_at, weight, height, blood_pressure, heart_rate,
--             temperature, oxygen_saturation, glucose (NULL — sem coluna)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_patient_vital_signs_history(integer);
CREATE OR REPLACE FUNCTION public.get_patient_vital_signs_history(p_limit integer DEFAULT 20)
RETURNS TABLE (
  recorded_at      timestamptz,
  weight           numeric,
  height           numeric,
  blood_pressure   text,
  heart_rate       integer,
  temperature      numeric,
  oxygen_saturation numeric,
  glucose          numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT
    tr.triaged_at                                                   AS recorded_at,
    tr.weight_kg                                                    AS weight,
    tr.height_cm::numeric                                           AS height,
    CASE
      WHEN tr.blood_pressure_systolic IS NOT NULL
       AND tr.blood_pressure_diastolic IS NOT NULL
      THEN tr.blood_pressure_systolic::text || '/' || tr.blood_pressure_diastolic::text
      ELSE NULL
    END                                                             AS blood_pressure,
    tr.heart_rate,
    tr.temperature,
    tr.oxygen_saturation,
    NULL::numeric                                                   AS glucose
  FROM public.triage_records tr
  WHERE tr.patient_id = v_client_id
    AND (
      tr.weight_kg IS NOT NULL
      OR tr.blood_pressure_systolic IS NOT NULL
      OR tr.heart_rate IS NOT NULL
    )
  ORDER BY tr.triaged_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_vital_signs_history(integer) TO authenticated;

-- ============================================================================
-- 2. get_patient_active_medications
--    Corrigido: retorna prescription_date, expiry_date, is_expired
--    (nomes exatos esperados pelo frontend)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_patient_active_medications();
CREATE OR REPLACE FUNCTION public.get_patient_active_medications()
RETURNS TABLE (
  id                uuid,
  medication_name   text,
  dosage            text,
  prescription_date timestamptz,
  expiry_date       date,
  professional_name text,
  is_expired        boolean
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
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT
    pr.id,
    LEFT(COALESCE(pr.medications, 'Medicamento'), 150)             AS medication_name,
    ''::text                                                        AS dosage,
    pr.issued_at                                                    AS prescription_date,
    COALESCE(
      pr.expires_at::date,
      (pr.issued_at + (COALESCE(pr.validity_days, 30) * INTERVAL '1 day'))::date
    )                                                               AS expiry_date,
    COALESCE(prof.full_name, '')                                    AS professional_name,
    COALESCE(
      pr.expires_at::date,
      (pr.issued_at + (COALESCE(pr.validity_days, 30) * INTERVAL '1 day'))::date
    ) < CURRENT_DATE                                                AS is_expired
  FROM public.prescriptions pr
  LEFT JOIN public.profiles prof ON prof.id = pr.professional_id
  WHERE pr.patient_id = v_client_id
    AND pr.tenant_id  = v_tenant_id
    AND pr.issued_at  > now() - INTERVAL '180 days'
  ORDER BY pr.issued_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_active_medications() TO authenticated;

-- ============================================================================
-- 3. get_patient_health_info
--    Corrigido: usa tabela patients (renomeada de clients em 20260330300000)
--    Restaura allergies (de triage_records) e last_vital_signs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_patient_health_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_patient     public.patients%ROWTYPE;
  v_vital_signs jsonb;
  v_allergies   text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  SELECT * INTO v_patient FROM public.patients WHERE id = v_client_id;

  -- Últimos sinais vitais registrados na triagem
  SELECT jsonb_build_object(
    'weight',            tr.weight_kg,
    'height',            tr.height_cm,
    'blood_pressure',    CASE
                           WHEN tr.blood_pressure_systolic IS NOT NULL
                            AND tr.blood_pressure_diastolic IS NOT NULL
                           THEN tr.blood_pressure_systolic::text || '/' || tr.blood_pressure_diastolic::text
                           ELSE NULL
                         END,
    'heart_rate',        tr.heart_rate,
    'temperature',       tr.temperature,
    'oxygen_saturation', tr.oxygen_saturation,
    'recorded_at',       tr.triaged_at
  ) INTO v_vital_signs
  FROM public.triage_records tr
  WHERE tr.patient_id = v_client_id
    AND (tr.weight_kg IS NOT NULL OR tr.blood_pressure_systolic IS NOT NULL)
  ORDER BY tr.triaged_at DESC
  LIMIT 1;

  -- Alergias anotadas na triagem mais recente
  SELECT tr.allergies INTO v_allergies
  FROM public.triage_records tr
  WHERE tr.patient_id = v_client_id
    AND tr.allergies IS NOT NULL
    AND tr.allergies <> ''
  ORDER BY tr.triaged_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'allergies',       v_allergies,
    'blood_type',      v_patient.blood_type,
    'birth_date',      v_patient.birth_date,
    'gender',          v_patient.gender,
    'last_vital_signs', COALESCE(v_vital_signs, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_health_info() TO authenticated;

-- ============================================================================
-- 4. get_patient_vaccinations
--    Corrigido: retorna nomes de colunas originais de patient_vaccinations
--    (client_id NÃO foi renomeado nessa tabela)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_patient_vaccinations();
CREATE OR REPLACE FUNCTION public.get_patient_vaccinations()
RETURNS TABLE (
  id              uuid,
  vaccine_name    text,
  dose_number     integer,
  batch_number    text,
  manufacturer    text,
  administered_at date,
  administered_by text,
  next_dose_date  date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT
    pv.id,
    pv.vaccine_name,
    pv.dose_number,
    pv.batch_number,
    pv.manufacturer,
    pv.administered_at,
    pv.administered_by,
    pv.next_dose_date
  FROM public.patient_vaccinations pv
  WHERE pv.client_id = v_client_id
  ORDER BY pv.administered_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_vaccinations() TO authenticated;
