-- RPC: activate_patient_account
-- Links a Firebase auth user to a patient record and creates patient_profile
-- Called by: activate-patient-account Edge Function (patient portal first access)

CREATE OR REPLACE FUNCTION public.activate_patient_account(p_client_id uuid, p_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
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
$function$;
