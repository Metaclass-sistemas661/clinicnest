CREATE OR REPLACE FUNCTION public.create_rnds_submission(p_resource_type rnds_resource_type, p_resource_id uuid, p_fhir_bundle jsonb, p_patient_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_medical_record_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_tenant_id UUID;

  v_submission_id UUID;

BEGIN

  v_tenant_id := get_user_tenant_id(current_setting('app.current_user_id')::uuid);

  

  INSERT INTO rnds_submissions (

    tenant_id,

    resource_type,

    resource_id,

    fhir_bundle,

    patient_id,

    appointment_id,

    medical_record_id,

    created_by

  ) VALUES (

    v_tenant_id,

    p_resource_type,

    p_resource_id,

    p_fhir_bundle,

    p_patient_id,

    p_appointment_id,

    p_medical_record_id,

    current_setting('app.current_user_id')::uuid

  )

  RETURNING id INTO v_submission_id;

  

  RETURN v_submission_id;

END;

$function$;