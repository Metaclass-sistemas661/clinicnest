-- ============================================================================
-- Migration: 20260703500000_fix_get_patient_dependents_columns_v1
-- Description: Fix get_patient_dependents() return columns to match frontend
--   Frontend expects: dependent_id, dependent_name, relationship, email, phone, birth_date
--   Old SQL returned:  id, name, relationship, birth_date, cpf, created_at
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_patient_dependents();
CREATE OR REPLACE FUNCTION public.get_patient_dependents()
RETURNS TABLE (
  dependent_id uuid,
  dependent_name text,
  relationship text,
  email text,
  phone text,
  birth_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT pp.client_id INTO v_patient_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = auth.uid() AND pp.is_active = true
  LIMIT 1;

  IF v_patient_id IS NULL THEN RAISE EXCEPTION 'Paciente não vinculado'; END IF;

  RETURN QUERY
  SELECT
    pd.id            AS dependent_id,
    p.name           AS dependent_name,
    pd.relationship  AS relationship,
    p.email          AS email,
    p.phone          AS phone,
    p.date_of_birth  AS birth_date
  FROM public.patient_dependents pd
  JOIN public.patients p ON p.id = pd.dependent_patient_id
  WHERE pd.parent_patient_id = v_patient_id
    AND pd.is_active = true
  ORDER BY p.name;
END;
$$;
