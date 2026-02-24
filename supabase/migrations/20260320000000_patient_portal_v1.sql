-- Patient Portal v1: patient_profiles table + RLS + helper RPCs
-- Links a Supabase Auth user (account_type=patient) to a client record in a tenant.

-- ─── Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON public.patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_tenant_client ON public.patient_profiles(tenant_id, client_id);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- Patients can read their own links
DROP POLICY IF EXISTS patient_profiles_select_own ON public.patient_profiles;
CREATE POLICY patient_profiles_select_own ON public.patient_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Clinic staff (admin/staff with profile in same tenant) can manage patient links
DROP POLICY IF EXISTS patient_profiles_manage_staff ON public.patient_profiles;
CREATE POLICY patient_profiles_manage_staff ON public.patient_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.tenant_id = p.tenant_id
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = patient_profiles.tenant_id
    )
  );

-- ─── RPC: link_patient_to_clinic ────────────────────────────
-- Called by clinic staff to link a patient user to a client record.
-- Validates that the caller is staff/admin of the tenant.
CREATE OR REPLACE FUNCTION public.link_patient_to_clinic(
  p_patient_user_id uuid,
  p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_profile public.profiles%rowtype;
  v_client public.clients%rowtype;
  v_existing public.patient_profiles%rowtype;
  v_result public.patient_profiles%rowtype;
BEGIN
  -- Validate caller is staff
  SELECT * INTO v_caller_profile FROM public.profiles WHERE user_id = v_caller_id LIMIT 1;
  IF v_caller_profile IS NULL THEN
    RAISE EXCEPTION 'NOT_STAFF' USING DETAIL = 'Caller has no profile';
  END IF;

  -- Validate client belongs to caller's tenant
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND tenant_id = v_caller_profile.tenant_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'CLIENT_NOT_FOUND' USING DETAIL = 'Client not found in your tenant';
  END IF;

  -- Check if already linked
  SELECT * INTO v_existing FROM public.patient_profiles
    WHERE user_id = p_patient_user_id AND tenant_id = v_caller_profile.tenant_id;

  IF v_existing IS NOT NULL THEN
    -- Update existing link
    UPDATE public.patient_profiles
      SET client_id = p_client_id, is_active = true, updated_at = now()
      WHERE id = v_existing.id
      RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.patient_profiles (user_id, tenant_id, client_id)
      VALUES (p_patient_user_id, v_caller_profile.tenant_id, p_client_id)
      RETURNING * INTO v_result;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'patient_profile_id', v_result.id,
    'client_id', v_result.client_id
  );
END;
$$;

-- ─── RPC: get_patient_appointments ──────────────────────────
-- Returns appointments for the authenticated patient user across all linked clinics.
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

-- ─── RPC: get_patient_telemedicine_appointments ─────────────
-- Returns telemedicine appointments for the patient (today/tomorrow).
CREATE OR REPLACE FUNCTION public.get_patient_telemedicine_appointments(
  p_date date DEFAULT CURRENT_DATE
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
      s.name AS service_name,
      p.full_name AS professional_name,
      t.name AS clinic_name
    FROM public.appointments a
    JOIN public.patient_profiles pp ON pp.tenant_id = a.tenant_id AND pp.client_id = a.client_id
    LEFT JOIN public.services s ON s.id = a.service_id
    LEFT JOIN public.profiles p ON p.id = a.professional_id
    LEFT JOIN public.tenants t ON t.id = a.tenant_id
    WHERE pp.user_id = v_user_id
      AND pp.is_active = true
      AND a.telemedicine = true
      AND a.status IN ('pending', 'confirmed')
      AND a.scheduled_at >= (p_date::timestamptz)
      AND a.scheduled_at < (p_date + interval '1 day')::timestamptz
    ORDER BY a.scheduled_at
  ) r;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.link_patient_to_clinic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_appointments(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_telemedicine_appointments(date) TO authenticated;
