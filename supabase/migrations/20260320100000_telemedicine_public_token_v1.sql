-- Telemedicine public token: allows patients to join via link without login.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS telemedicine_token uuid UNIQUE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_telemedicine_token
  ON public.appointments(telemedicine_token) WHERE telemedicine_token IS NOT NULL;

-- RPC: generate_telemedicine_token
-- Called by clinic staff. Generates a unique token for a telemedicine appointment.
-- Returns the token and the public URL path.
CREATE OR REPLACE FUNCTION public.generate_telemedicine_token(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_apt record;
  v_token uuid;
BEGIN
  -- Validate caller is staff
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_caller_id LIMIT 1;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'NOT_STAFF';
  END IF;

  -- Validate appointment belongs to caller's tenant and is telemedicine
  SELECT id, tenant_id, telemedicine, telemedicine_token
    INTO v_apt
    FROM public.appointments
    WHERE id = p_appointment_id AND tenant_id = v_profile.tenant_id;

  IF v_apt IS NULL THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND';
  END IF;

  IF v_apt.telemedicine IS NOT TRUE THEN
    RAISE EXCEPTION 'NOT_TELEMEDICINE';
  END IF;

  -- Reuse existing token if present
  IF v_apt.telemedicine_token IS NOT NULL THEN
    RETURN jsonb_build_object(
      'token', v_apt.telemedicine_token,
      'already_existed', true
    );
  END IF;

  -- Generate new token
  v_token := gen_random_uuid();

  UPDATE public.appointments
    SET telemedicine_token = v_token, updated_at = now()
    WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'token', v_token,
    'already_existed', false
  );
END;
$$;

-- RPC: get_appointment_by_telemedicine_token
-- Public RPC (no auth required) to validate a telemedicine token and return appointment info.
CREATE OR REPLACE FUNCTION public.get_appointment_by_telemedicine_token(
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'tenant_id', a.tenant_id,
    'scheduled_at', a.scheduled_at,
    'duration_minutes', a.duration_minutes,
    'status', a.status,
    'service_name', COALESCE(s.name, ''),
    'professional_name', COALESCE(p.full_name, ''),
    'clinic_name', COALESCE(t.name, ''),
    'client_name', COALESCE(c.name, '')
  )
  INTO v_result
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.profiles p ON p.id = a.professional_id
  LEFT JOIN public.tenants t ON t.id = a.tenant_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  WHERE a.telemedicine_token = p_token
    AND a.telemedicine = true
    AND a.status IN ('pending', 'confirmed');

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'TOKEN_INVALID_OR_EXPIRED');
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_telemedicine_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_telemedicine_token(uuid) TO anon, authenticated;
