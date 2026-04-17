CREATE OR REPLACE FUNCTION public.update_patient_contact(p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_zip_code text DEFAULT NULL::text, p_street text DEFAULT NULL::text, p_street_number text DEFAULT NULL::text, p_complement text DEFAULT NULL::text, p_neighborhood text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id   uuid := current_setting('app.current_user_id')::uuid;

  v_link      record;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');

  END IF;



  SELECT client_id, tenant_id INTO v_link

  FROM public.patient_profiles

  WHERE user_id = v_user_id AND is_active = true

  LIMIT 1;



  IF v_link IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'NO_LINK');

  END IF;



  UPDATE public.patients SET

    phone          = COALESCE(NULLIF(TRIM(p_phone), ''), phone),

    email          = COALESCE(NULLIF(TRIM(p_email), ''), email),

    zip_code       = COALESCE(NULLIF(TRIM(p_zip_code), ''), zip_code),

    street         = COALESCE(NULLIF(TRIM(p_street), ''), street),

    street_number  = COALESCE(NULLIF(TRIM(p_street_number), ''), street_number),

    complement     = CASE WHEN p_complement IS NOT NULL THEN NULLIF(TRIM(p_complement), '') ELSE complement END,

    neighborhood   = COALESCE(NULLIF(TRIM(p_neighborhood), ''), neighborhood),

    city           = COALESCE(NULLIF(TRIM(p_city), ''), city),

    state          = COALESCE(NULLIF(TRIM(p_state), ''), state),

    updated_at     = now()

  WHERE id = v_link.client_id;



  RETURN jsonb_build_object('success', true);

END;

$function$;