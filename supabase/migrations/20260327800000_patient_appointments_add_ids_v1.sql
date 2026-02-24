-- Atualiza get_patient_appointments para incluir service_id e professional_id
-- Necessário para o reagendamento com verificação de disponibilidade

CREATE OR REPLACE FUNCTION public.get_patient_appointments(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      a.id,
      a.tenant_id,
      a.scheduled_at,
      a.duration_minutes,
      a.status,
      a.notes,
      a.telemedicine,
      a.service_id,
      a.professional_id,
      c.name AS client_name,
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name
    FROM public.appointments a
    JOIN public.patient_profiles pp ON pp.tenant_id = a.tenant_id AND pp.client_id = a.client_id
    LEFT JOIN public.clients c ON c.id = a.client_id
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE pp.user_id = v_user_id
      AND pp.is_active = true
      AND (p_from IS NULL OR a.scheduled_at >= p_from)
      AND (p_to IS NULL OR a.scheduled_at <= p_to)
      AND (p_status IS NULL OR a.status = p_status::public.appointment_status)
    ORDER BY a.scheduled_at DESC
    LIMIT 200
  ) r;

  RETURN v_result;
END;
$$;
