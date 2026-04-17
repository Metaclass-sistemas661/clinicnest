CREATE OR REPLACE FUNCTION public.patient_delete_uploaded_exam(p_exam_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_uid  uuid := current_setting('app.current_user_id')::uuid;

  v_path TEXT;

BEGIN

  SELECT file_path INTO v_path

    FROM public.patient_uploaded_exams

   WHERE id = p_exam_id AND user_id = v_uid AND status = 'pendente';



  IF v_path IS NULL THEN

    RAISE EXCEPTION 'exam_not_found_or_already_reviewed';

  END IF;



  DELETE FROM public.patient_uploaded_exams

  WHERE id = p_exam_id AND user_id = v_uid AND status = 'pendente';



  RETURN jsonb_build_object('success', true, 'deleted_path', v_path);

END;

$function$;