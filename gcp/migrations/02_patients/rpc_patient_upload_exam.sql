CREATE OR REPLACE FUNCTION public.patient_upload_exam(p_file_name text, p_file_path text, p_file_size bigint, p_mime_type text, p_exam_name text DEFAULT ''::text, p_exam_date date DEFAULT NULL::date, p_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_uid  uuid := current_setting('app.current_user_id')::uuid;

  v_link RECORD;

  v_id   uuid;

BEGIN

  -- Get the first active patient link (tenant + patient_id)

  SELECT pp.tenant_id, pp.client_id

    INTO v_link

    FROM public.patient_profiles pp

   WHERE pp.user_id = v_uid

     AND pp.is_active = true

   LIMIT 1;



  IF v_link IS NULL THEN

    RAISE EXCEPTION 'patient_not_linked';

  END IF;



  INSERT INTO public.patient_uploaded_exams (

    tenant_id, patient_id, user_id,

    file_name, file_path, file_size, mime_type,

    exam_name, exam_date, notes

  ) VALUES (

    v_link.tenant_id, v_link.client_id, v_uid,

    p_file_name, p_file_path, p_file_size, p_mime_type,

    p_exam_name, p_exam_date, p_notes

  )

  RETURNING id INTO v_id;



  RETURN jsonb_build_object('id', v_id, 'success', true);

END;

$function$;