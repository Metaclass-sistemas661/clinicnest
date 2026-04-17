CREATE OR REPLACE FUNCTION public.get_patient_exam_results(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_uid uuid := current_setting('app.current_user_id')::uuid;

  v_link record;

BEGIN

  IF v_uid IS NULL THEN RAISE EXCEPTION 'N├úo autenticado'; END IF;



  FOR v_link IN

    SELECT pp.tenant_id, pp.client_id

    FROM public.patient_profiles pp

    WHERE pp.user_id = v_uid

      AND pp.is_active = true

      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)

  LOOP

    RETURN QUERY

      SELECT jsonb_build_object(

        'id', e.id,

        'tenant_id', e.tenant_id,

        'exam_type', e.exam_type,

        'exam_name', e.exam_name,

        'performed_at', e.performed_at,

        'lab_name', e.lab_name,

        'result_text', e.result_text,

        'reference_values', e.reference_values,

        'interpretation', e.interpretation,

        'status', e.status,

        'file_url', e.file_url,

        'file_name', e.file_name,

        'notes', e.notes,

        'requested_by_name', COALESCE(pr.full_name, ''),

        'clinic_name', COALESCE(t.name, ''),

        'tuss_code', e.tuss_code,

        'priority', e.priority,

        'exam_category', e.exam_category,

        'performed_by_name', COALESCE(perf.full_name, ''),

        'created_at', e.created_at

      )

      FROM public.exam_results e

      LEFT JOIN public.profiles pr ON pr.id = e.requested_by

      LEFT JOIN public.profiles perf ON perf.id = e.performed_by

      LEFT JOIN public.tenants t ON t.id = e.tenant_id

      WHERE e.patient_id = v_link.client_id

        AND e.tenant_id = v_link.tenant_id

      ORDER BY e.created_at DESC;

  END LOOP;

END;

$function$;