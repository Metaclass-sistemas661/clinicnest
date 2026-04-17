CREATE OR REPLACE FUNCTION public.link_patient_to_clinic(p_patient_user_id uuid, p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_caller_id uuid := current_setting('app.current_user_id')::uuid;

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

$function$;