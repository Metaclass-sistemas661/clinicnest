CREATE OR REPLACE FUNCTION public.remove_patient_dependent(p_dependent_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_patient_user_id uuid;

  v_parent_patient_id uuid;

  v_relationship_exists boolean;

BEGIN

  v_patient_user_id := current_setting('app.current_user_id')::uuid;

  IF v_patient_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'message', 'Usu├írio n├úo autenticado');

  END IF;



  SELECT pp.client_id INTO v_parent_patient_id

  FROM public.patient_profiles pp

  WHERE pp.user_id = v_patient_user_id AND pp.is_active = true

  LIMIT 1;



  IF v_parent_patient_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'message', 'Cadastro de paciente n├úo encontrado');

  END IF;



  SELECT EXISTS(

    SELECT 1 FROM public.patient_dependents pd

    WHERE pd.parent_patient_id = v_parent_patient_id

    AND pd.dependent_patient_id = p_dependent_id

  ) INTO v_relationship_exists;



  IF NOT v_relationship_exists THEN

    RETURN jsonb_build_object('success', false, 'message', 'Dependente n├úo encontrado');

  END IF;



  UPDATE public.patient_dependents

  SET is_active = false, updated_at = now()

  WHERE parent_patient_id = v_parent_patient_id

  AND dependent_patient_id = p_dependent_id;



  RETURN jsonb_build_object(

    'success', true,

    'message', 'Dependente removido com sucesso'

  );



EXCEPTION WHEN OTHERS THEN

  RETURN jsonb_build_object('success', false, 'message', SQLERRM);

END;

$function$;