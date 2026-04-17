CREATE OR REPLACE FUNCTION public.get_preconsultation_form_for_appointment(p_appointment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id   uuid;

  v_service_id  uuid;

  v_form        jsonb;

  v_already     boolean;

BEGIN

  SELECT a.tenant_id, a.service_id

  INTO v_tenant_id, v_service_id

  FROM appointments a

  WHERE a.id = p_appointment_id;



  IF v_tenant_id IS NULL THEN

    RETURN jsonb_build_object('found', false);

  END IF;



  -- Verifica se tenant tem pr├®-consulta habilitada

  IF NOT (SELECT COALESCE(t.pre_consultation_enabled, false) FROM tenants t WHERE t.id = v_tenant_id) THEN

    RETURN jsonb_build_object('found', false);

  END IF;



  -- Verifica se j├í respondeu

  SELECT EXISTS(

    SELECT 1 FROM pre_consultation_responses r WHERE r.appointment_id = p_appointment_id

  ) INTO v_already;



  IF v_already THEN

    RETURN jsonb_build_object('found', false, 'already_submitted', true);

  END IF;



  -- Busca formul├írio: primeiro espec├¡fico ao servi├ºo, sen├úo gen├®rico

  SELECT jsonb_build_object(

    'id', f.id,

    'name', f.name,

    'description', f.description,

    'fields', f.fields

  ) INTO v_form

  FROM pre_consultation_forms f

  WHERE f.tenant_id = v_tenant_id

    AND f.is_active = true

    AND (f.service_id = v_service_id OR f.service_id IS NULL)

  ORDER BY

    CASE WHEN f.service_id = v_service_id THEN 0 ELSE 1 END,

    f.created_at DESC

  LIMIT 1;



  IF v_form IS NULL THEN

    RETURN jsonb_build_object('found', false);

  END IF;



  RETURN jsonb_build_object('found', true, 'form', v_form);

END;

$function$;