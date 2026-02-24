-- Migration: Patient Dependents Management RPCs
-- Adds functions for patients to manage their dependents

-- RPC: Add a dependent
CREATE OR REPLACE FUNCTION public.add_patient_dependent(
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_relationship text DEFAULT 'outro'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_parent_client_id uuid;
  v_tenant_id uuid;
  v_new_client_id uuid;
  v_dependent_id uuid;
BEGIN
  -- Get current user
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  -- Get parent client record
  SELECT pp.client_id, pp.tenant_id INTO v_parent_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_parent_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cadastro de paciente não encontrado');
  END IF;

  -- Validate relationship
  IF p_relationship NOT IN ('filho', 'filha', 'pai', 'mae', 'conjuge', 'outro') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tipo de parentesco inválido');
  END IF;

  -- Create new client record for the dependent
  INSERT INTO public.clients (
    tenant_id,
    name,
    email,
    phone,
    birth_date,
    is_dependent,
    created_by_patient
  ) VALUES (
    v_tenant_id,
    p_name,
    p_email,
    p_phone,
    p_birth_date,
    true,
    true
  )
  RETURNING id INTO v_new_client_id;

  -- Create dependent relationship
  INSERT INTO public.patient_dependents (
    tenant_id,
    parent_client_id,
    dependent_client_id,
    relationship
  ) VALUES (
    v_tenant_id,
    v_parent_client_id,
    v_new_client_id,
    p_relationship
  )
  RETURNING id INTO v_dependent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Dependente adicionado com sucesso',
    'dependent_id', v_new_client_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- RPC: Remove a dependent
CREATE OR REPLACE FUNCTION public.remove_patient_dependent(
  p_dependent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_parent_client_id uuid;
  v_relationship_exists boolean;
BEGIN
  -- Get current user
  v_patient_user_id := auth.uid();
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  -- Get parent client record
  SELECT pp.client_id INTO v_parent_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_parent_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cadastro de paciente não encontrado');
  END IF;

  -- Check if relationship exists and belongs to this patient
  SELECT EXISTS(
    SELECT 1 FROM public.patient_dependents pd
    WHERE pd.parent_client_id = v_parent_client_id
    AND pd.dependent_client_id = p_dependent_id
  ) INTO v_relationship_exists;

  IF NOT v_relationship_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dependente não encontrado');
  END IF;

  -- Remove the relationship (soft delete by setting is_active = false)
  UPDATE public.patient_dependents
  SET is_active = false, updated_at = now()
  WHERE parent_client_id = v_parent_client_id
  AND dependent_client_id = p_dependent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Dependente removido com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Update get_patient_dependents to include more details
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
  v_patient_user_id uuid;
  v_parent_client_id uuid;
BEGIN
  v_patient_user_id := auth.uid();
  
  IF v_patient_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT pp.client_id INTO v_parent_client_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_parent_client_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    pd.dependent_client_id as dependent_id,
    c.name as dependent_name,
    pd.relationship,
    c.email,
    c.phone,
    c.birth_date
  FROM public.patient_dependents pd
  JOIN public.clients c ON c.id = pd.dependent_client_id
  WHERE pd.parent_client_id = v_parent_client_id
  AND pd.is_active = true
  ORDER BY c.name;
END;
$$;

-- Add columns to clients table if not exist
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_dependent boolean DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by_patient boolean DEFAULT false;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.add_patient_dependent(text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_patient_dependent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_dependents() TO authenticated;

-- Update patient_create_appointment to support dependents
CREATE OR REPLACE FUNCTION public.patient_create_appointment(
  p_service_id uuid,
  p_professional_id uuid,
  p_scheduled_at timestamptz,
  p_for_dependent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user_id uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_appointment_id uuid;
  v_service_name text;
  v_professional_name text;
  v_max_pending int;
  v_current_pending int;
  v_is_valid_dependent boolean;
BEGIN
  v_patient_user_id := auth.uid();
  
  IF v_patient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  -- Get client record
  SELECT pp.client_id, pp.tenant_id INTO v_client_id, v_tenant_id
  FROM public.patient_profiles pp
  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cadastro não encontrado');
  END IF;

  -- If booking for a dependent, validate the relationship
  IF p_for_dependent_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.patient_dependents pd
      WHERE pd.parent_client_id = v_client_id
      AND pd.dependent_client_id = p_for_dependent_id
      AND pd.is_active = true
    ) INTO v_is_valid_dependent;

    IF NOT v_is_valid_dependent THEN
      RETURN jsonb_build_object('success', false, 'message', 'Dependente não encontrado ou não autorizado');
    END IF;

    -- Use dependent's client_id for the appointment
    v_client_id := p_for_dependent_id;
  END IF;

  -- Get booking settings
  SELECT (t.patient_booking_settings->>'max_pending')::int
  INTO v_max_pending
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  v_max_pending := COALESCE(v_max_pending, 3);

  -- Check pending appointments limit (for the parent account)
  SELECT COUNT(*) INTO v_current_pending
  FROM public.appointments a
  WHERE (
    a.client_id = v_client_id 
    OR a.client_id IN (
      SELECT pd.dependent_client_id 
      FROM public.patient_dependents pd 
      WHERE pd.parent_client_id = (
        SELECT pp.client_id FROM public.patient_profiles pp WHERE pp.user_id = v_patient_user_id AND pp.is_active = true LIMIT 1
      )
    )
  )
  AND a.status IN ('pending', 'confirmed')
  AND a.scheduled_at > now();

  IF v_current_pending >= v_max_pending THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', format('Você já possui %s agendamentos pendentes. Limite máximo: %s', v_current_pending, v_max_pending)
    );
  END IF;

  -- Get service and professional names
  SELECT s.name INTO v_service_name FROM public.services s WHERE s.id = p_service_id;
  SELECT p.full_name INTO v_professional_name FROM public.profiles p WHERE p.id = p_professional_id;

  -- Create appointment
  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    professional_id,
    scheduled_at,
    status,
    source,
    notes
  ) VALUES (
    v_tenant_id,
    v_client_id,
    p_service_id,
    p_professional_id,
    p_scheduled_at,
    'pending',
    'patient_portal',
    CASE WHEN p_for_dependent_id IS NOT NULL THEN 'Agendado pelo responsável via Portal do Paciente' ELSE 'Agendado via Portal do Paciente' END
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Agendamento de %s com %s criado com sucesso!', v_service_name, v_professional_name),
    'appointment_id', v_appointment_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_create_appointment(uuid, uuid, timestamptz, uuid) TO authenticated;
