CREATE OR REPLACE FUNCTION public.get_patient_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := current_setting('app.current_user_id')::uuid;

  v_link   record;

  v_pat    record;

BEGIN

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('error', 'NOT_AUTHENTICATED');

  END IF;



  SELECT client_id, tenant_id INTO v_link

  FROM public.patient_profiles

  WHERE user_id = v_user_id AND is_active = true

  LIMIT 1;



  IF v_link IS NULL THEN

    RETURN jsonb_build_object('error', 'NO_LINK');

  END IF;



  SELECT

    p.id,

    p.name,

    p.email,

    p.phone,

    p.cpf,

    p.date_of_birth,

    p.marital_status,

    p.zip_code,

    p.street,

    p.street_number,

    p.complement,

    p.neighborhood,

    p.city,

    p.state,

    p.allergies

  INTO v_pat

  FROM public.patients p

  WHERE p.id = v_link.client_id;



  IF v_pat IS NULL THEN

    RETURN jsonb_build_object('error', 'NOT_FOUND');

  END IF;



  RETURN jsonb_build_object(

    'id',              v_pat.id,

    'name',            COALESCE(v_pat.name, ''),

    'email',           v_pat.email,

    'phone',           v_pat.phone,

    'cpf',             v_pat.cpf,

    'date_of_birth',   v_pat.date_of_birth,

    'marital_status',  v_pat.marital_status,

    'zip_code',        v_pat.zip_code,

    'street',          v_pat.street,

    'street_number',   v_pat.street_number,

    'complement',      v_pat.complement,

    'neighborhood',    v_pat.neighborhood,

    'city',            v_pat.city,

    'state',           v_pat.state,

    'allergies',       v_pat.allergies

  );

END;

$function$;