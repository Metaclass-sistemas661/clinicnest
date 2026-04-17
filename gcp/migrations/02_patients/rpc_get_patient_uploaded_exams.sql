CREATE OR REPLACE FUNCTION public.get_patient_uploaded_exams()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_uid uuid := current_setting('app.current_user_id')::uuid;

BEGIN

  RETURN QUERY

    SELECT jsonb_build_object(

      'id', pue.id,

      'file_name', pue.file_name,

      'file_path', pue.file_path,

      'file_size', pue.file_size,

      'mime_type', pue.mime_type,

      'exam_name', pue.exam_name,

      'exam_date', pue.exam_date,

      'notes', pue.notes,

      'status', pue.status,

      'reviewed_by_name', COALESCE(pr.full_name, ''),

      'reviewed_at', pue.reviewed_at,

      'created_at', pue.created_at,

      'clinic_name', COALESCE(t.name, '')

    )

    FROM public.patient_uploaded_exams pue

    LEFT JOIN public.profiles pr ON pr.id = pue.reviewed_by

    LEFT JOIN public.tenants t ON t.id = pue.tenant_id

    WHERE pue.user_id = v_uid

    ORDER BY pue.created_at DESC;

END;

$function$;