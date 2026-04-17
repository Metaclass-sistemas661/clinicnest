CREATE OR REPLACE FUNCTION public.add_patient_dependent(p_name text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_relationship text DEFAULT 'outro'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_patient_user_id uuid;

  v_parent_patient_id uuid;

  v_tenant_id uuid;

  v_new_patient_id uuid;

  v_dependent_id uuid;

BEGIN

  v_patient_user_id := current_setting('app.current_user_id')::uuid;

  IF v_patient_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'message', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT pp.client_id, pp.tenant_id INTO v_parent_patient_id, v_tenant_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true

  LIMIT 1;



  IF v_parent_patient_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'message', 'Cadastro de paciente n├úo encontrado');

  END IF;



  IF p_relationship NOT IN ('filho', 'filha', 'pai', 'mae', 'conjuge', 'outro') THEN

    RETURN jsonb_build_object('success', false, 'message', 'Tipo de parentesco inv├ílido');

  END IF;



  INSERT INTO public.patients (

    tenant_id, name, email, phone, birth_date, is_dependent, created_by_patient

  ) VALUES (

    v_tenant_id, p_name, p_email, p_phone, p_birth_date, true, true

  )

  RETURNING id INTO v_new_patient_id;



  INSERT INTO public.patient_dependents (

    tenant_id, parent_patient_id, dependent_patient_id, relationship

  ) VALUES (

    v_tenant_id, v_parent_patient_id, v_new_patient_id, p_relationship

  )

  RETURNING id INTO v_dependent_id;



  RETURN jsonb_build_object(

    'success', true,

    'message', 'Dependente adicionado com sucesso',

    'dependent_id', v_new_patient_id

  );



EXCEPTION WHEN OTHERS THEN

  RETURN jsonb_build_object('success', false, 'message', SQLERRM);

END;

$function$;