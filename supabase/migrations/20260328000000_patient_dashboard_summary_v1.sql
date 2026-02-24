-- RPC para obter resumo do dashboard do paciente
-- Retorna status de vinculação, nome da clínica e próximas consultas

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

  -- Check if patient is linked
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
    WHERE a.client_id = v_client_id
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
    WHERE a.client_id = v_client_id
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

GRANT EXECUTE ON FUNCTION public.get_patient_dashboard_summary() TO authenticated;
