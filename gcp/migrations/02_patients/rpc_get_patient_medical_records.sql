CREATE OR REPLACE FUNCTION public.get_patient_medical_records(p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_uid uuid := current_setting('app.current_user_id')::uuid;

  v_link record;

BEGIN

  FOR v_link IN

    SELECT pp.tenant_id, pp.client_id

    FROM public.patient_profiles pp

    WHERE pp.user_id = v_uid

      AND pp.is_active = true

      AND (p_tenant_id IS NULL OR pp.tenant_id = p_tenant_id)

  LOOP

    RETURN QUERY

      SELECT jsonb_build_object(

        'id', mr.id,

        'tenant_id', mr.tenant_id,

        'record_date', mr.record_date,

        'chief_complaint', mr.chief_complaint,

        'diagnosis', mr.diagnosis,

        'cid_code', mr.cid_code,

        'treatment_plan', mr.treatment_plan,

        'professional_name', COALESCE(pr.full_name, ''),

        'specialty_name', COALESCE(sp.name, ''),

        'clinic_name', COALESCE(t.name, '')

      )

      FROM public.medical_records mr

      LEFT JOIN public.profiles pr ON pr.id = mr.professional_id

      LEFT JOIN public.specialties sp ON sp.id = mr.specialty_id

      LEFT JOIN public.tenants t ON t.id = mr.tenant_id

      WHERE mr.patient_id = v_link.client_id

        AND mr.tenant_id = v_link.tenant_id

        AND mr.is_confidential = false

      ORDER BY mr.record_date DESC;

  END LOOP;

END;

$function$;