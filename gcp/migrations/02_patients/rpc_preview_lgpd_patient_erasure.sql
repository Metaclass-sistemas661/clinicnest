CREATE OR REPLACE FUNCTION public.preview_lgpd_patient_erasure(p_tenant_id uuid, p_patient_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_requester UUID := current_setting('app.current_user_id')::uuid;

  v_patient_name TEXT;

  v_counts JSONB;

BEGIN

  IF v_requester IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo autenticado';

  END IF;



  IF NOT public.is_tenant_admin(v_requester, p_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem visualizar pr├®via de exclus├úo';

  END IF;



  SELECT name INTO v_patient_name

  FROM public.patients

  WHERE id = p_patient_id AND tenant_id = p_tenant_id;



  IF v_patient_name IS NULL THEN

    RAISE EXCEPTION 'Paciente n├úo encontrado neste tenant';

  END IF;



  SELECT jsonb_build_object(

    'patient_name', v_patient_name,

    'patient_id', p_patient_id,

    'confirmation_token', 'ERASE_PATIENT:' || p_patient_id::text,

    'will_delete', jsonb_build_object(

      'audit_logs', (SELECT count(*) FROM public.audit_logs WHERE tenant_id = p_tenant_id AND entity_type = 'patients' AND entity_id = p_patient_id::text),

      'notifications', (SELECT count(*) FROM public.notifications WHERE tenant_id = p_tenant_id AND metadata->>'patient_id' = p_patient_id::text)

    ),

    'will_anonymize', jsonb_build_object(

      'patient_record', 1,

      'medical_records', (SELECT count(*) FROM public.medical_records WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),

      'prescriptions', (SELECT count(*) FROM public.prescriptions WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),

      'certificates', (SELECT count(*) FROM public.medical_certificates WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),

      'exams', (SELECT count(*) FROM public.exam_results WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),

      'referrals', (SELECT count(*) FROM public.referrals WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),

      'evolutions', (SELECT count(*) FROM public.clinical_evolutions WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id),

      'appointments', (SELECT count(*) FROM public.appointments WHERE tenant_id = p_tenant_id AND patient_id = p_patient_id)

    ),

    'warning', 'Esta a├º├úo ├® IRREVERS├ìVEL. Dados pessoais ser├úo permanentemente removidos. Dados cl├¡nicos ser├úo anonimizados conforme CFM 1821/07.'

  ) INTO v_counts;



  RETURN v_counts;

END;

$function$;