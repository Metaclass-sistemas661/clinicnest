-- ============================================================================
-- LGPD: Exportar dados pessoais (Art. 18) + Solicitar exclusão (Art. 17)
--
-- RPCs:
--   1. export_patient_data — Retorna JSON com todos os dados do paciente
--   2. request_patient_account_deletion — Cria solicitação de exclusão
--   3. cancel_patient_account_deletion — Cancela solicitação (período de carência)
--
-- Tabela:
--   patient_deletion_requests — Rastreia solicitações de exclusão
-- ============================================================================

-- 1. Tabela de solicitações de exclusão
CREATE TABLE IF NOT EXISTS public.patient_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  user_id UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id)
);

ALTER TABLE public.patient_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_own_deletion_requests"
  ON public.patient_deletion_requests
  FOR ALL
  USING (user_id = auth.uid());

-- Index para busca de solicitações pendentes
CREATE INDEX IF NOT EXISTS idx_patient_deletion_status
  ON public.patient_deletion_requests (status, scheduled_for)
  WHERE status = 'pending';

-- 2. RPC: Exportar dados do paciente (LGPD Art. 18)
CREATE OR REPLACE FUNCTION public.export_patient_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_patient RECORD;
  v_result jsonb;
  v_appointments jsonb;
  v_prescriptions jsonb;
  v_certificates jsonb;
  v_exams jsonb;
  v_messages jsonb;
  v_consents jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Não autenticado');
  END IF;

  -- Find patient
  SELECT p.id, p.name, p.email, p.phone, p.cpf, p.birth_date,
         p.gender, p.address, p.city, p.state, p.zip_code,
         p.tenant_id, p.created_at,
         t.name AS clinic_name
  INTO v_patient
  FROM public.patients p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('error', 'Paciente não encontrado');
  END IF;

  -- Appointments
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', a.date,
    'time', a.time,
    'status', a.status,
    'service', s.name,
    'professional', st.name,
    'notes', a.notes,
    'created_at', a.created_at
  ) ORDER BY a.date DESC), '[]'::jsonb)
  INTO v_appointments
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.staff st ON st.id = a.staff_id
  WHERE a.patient_id = v_patient.id;

  -- Prescriptions
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', pr.created_at,
    'medications', pr.medications,
    'notes', pr.notes
  ) ORDER BY pr.created_at DESC), '[]'::jsonb)
  INTO v_prescriptions
  FROM public.prescriptions pr
  WHERE pr.patient_id = v_patient.id;

  -- Certificates
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', c.created_at,
    'type', c.type,
    'content', c.content
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_certificates
  FROM public.certificates c
  WHERE c.patient_id = v_patient.id;

  -- Exams
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', e.created_at,
    'name', e.name,
    'status', e.status
  ) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_exams
  FROM public.exams e
  WHERE e.patient_id = v_patient.id;

  -- Messages
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', m.created_at,
    'content', m.content,
    'sender', m.sender_type
  ) ORDER BY m.created_at DESC), '[]'::jsonb)
  INTO v_messages
  FROM public.messages m
  WHERE m.patient_id = v_patient.id;

  -- Consents
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', pc.signed_at,
    'document', pc.document_title,
    'ip', pc.ip_address
  ) ORDER BY pc.signed_at DESC), '[]'::jsonb)
  INTO v_consents
  FROM public.patient_consents pc
  WHERE pc.patient_id = v_patient.id;

  -- Build final result
  v_result := jsonb_build_object(
    'export_date', now(),
    'patient', jsonb_build_object(
      'name', v_patient.name,
      'email', v_patient.email,
      'phone', v_patient.phone,
      'cpf', v_patient.cpf,
      'birth_date', v_patient.birth_date,
      'gender', v_patient.gender,
      'address', v_patient.address,
      'city', v_patient.city,
      'state', v_patient.state,
      'zip_code', v_patient.zip_code,
      'registered_at', v_patient.created_at,
      'clinic', v_patient.clinic_name
    ),
    'appointments', v_appointments,
    'prescriptions', v_prescriptions,
    'certificates', v_certificates,
    'exams', v_exams,
    'messages', v_messages,
    'consents', v_consents
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_patient_data() TO authenticated;

-- 3. RPC: Solicitar exclusão da conta (LGPD Art. 17)
CREATE OR REPLACE FUNCTION public.request_patient_account_deletion(
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_patient RECORD;
  v_existing RECORD;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Find patient
  SELECT id, tenant_id, name
  INTO v_patient
  FROM public.patients
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_patient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paciente não encontrado');
  END IF;

  -- Check if there's already a pending request
  SELECT id INTO v_existing
  FROM public.patient_deletion_requests
  WHERE patient_id = v_patient.id AND status = 'pending'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe uma solicitação de exclusão pendente');
  END IF;

  -- Create deletion request (30 days grace period)
  INSERT INTO public.patient_deletion_requests (patient_id, user_id, reason, tenant_id)
  VALUES (v_patient.id, v_user_id, p_reason, v_patient.tenant_id)
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'scheduled_for', (now() + interval '30 days'),
    'message', 'Sua solicitação foi registrada. Seus dados serão removidos em 30 dias. Você pode cancelar durante esse período.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_patient_account_deletion(TEXT) TO authenticated;

-- 4. RPC: Cancelar solicitação de exclusão
CREATE OR REPLACE FUNCTION public.cancel_patient_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_request
  FROM public.patient_deletion_requests
  WHERE user_id = v_user_id AND status = 'pending'
  ORDER BY requested_at DESC
  LIMIT 1;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma solicitação pendente encontrada');
  END IF;

  UPDATE public.patient_deletion_requests
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_request.id;

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação de exclusão cancelada com sucesso');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_patient_account_deletion() TO authenticated;
