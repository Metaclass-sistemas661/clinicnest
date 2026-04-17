CREATE OR REPLACE FUNCTION public.auto_link_patient()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

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

$function$;